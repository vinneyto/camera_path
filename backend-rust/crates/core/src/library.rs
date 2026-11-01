use crate::{
    Error, Result,
    database::{self, Db},
    entities::{library_assets, project_clouds, projects},
    models::new_id,
    ports::Storage,
};
use sea_orm::{ActiveValue::Set, ExprTrait, IntoActiveModel, QueryOrder, entity::prelude::*};
use serde_json::{Value, json};
use std::sync::Arc;
#[derive(Clone)]
pub struct Library {
    pub db: Db,
    pub storage: Arc<dyn Storage>,
}
fn external(error: anyhow::Error) -> Error {
    eprintln!("storage operation failed: {error}");
    Error::new(502, "upstream_error", "Storage operation failed")
}
impl Library {
    pub async fn record(&self, id: &str) -> Result<library_assets::Model> {
        library_assets::Entity::find_by_id(id)
            .one(&self.db.connection)
            .await?
            .ok_or_else(|| Error::missing("Library file", id))
    }
    pub async fn model(&self, r: &library_assets::Model, origin: &str) -> Result<Value> {
        let url = if r.status == "ready" {
            Some(
                self.storage
                    .download_url(&r.id, &r.object_key, origin)
                    .await
                    .map_err(external)?,
            )
        } else {
            None
        };
        Ok(
            json!({"id":r.id,"name":r.name,"format":r.format,"size_bytes":r.size_bytes,"status":r.status,"created_at":r.created_at,"download_url":url,"default_rotation_deg":[r.default_rotation_x_deg,r.default_rotation_y_deg,r.default_rotation_z_deg],"default_scale":r.default_scale,"default_offset":[r.default_offset_x,r.default_offset_y,r.default_offset_z]}),
        )
    }
    pub async fn list(&self, origin: &str) -> Result<Value> {
        let rows = library_assets::Entity::find()
            .filter(library_assets::Column::Status.eq("ready"))
            .order_by_asc(library_assets::Column::CreatedAt)
            .order_by_asc(library_assets::Column::Id)
            .all(&self.db.connection)
            .await?;
        let mut out = vec![];
        for row in rows {
            out.push(self.model(&row, origin).await?);
        }
        Ok(json!(out))
    }
    pub async fn get(&self, id: &str, origin: &str) -> Result<Value> {
        let r = self.record(id).await?;
        if r.status != "ready" {
            return Err(Error::missing("Library file", id));
        }
        self.model(&r, origin).await
    }
    pub async fn create(&self, value: &Value, origin: &str) -> Result<Value> {
        let name = value["name"].as_str().unwrap_or("").trim();
        let size = value["size_bytes"].as_i64().unwrap_or(0);
        let format = value.get("format").and_then(Value::as_str).unwrap_or("ply");
        if name.is_empty()
            || name.chars().count() > 200
            || size <= 0
            || size > 2 * 1024 * 1024 * 1024
            || !["ply", "sog"].contains(&format)
        {
            return Err(Error::invalid("Invalid library upload"));
        }
        let id = new_id();
        let key = format!("{id}.{format}");
        let upload = self
            .storage
            .upload_url(&id, &key, origin)
            .await
            .map_err(external)?;
        let row = library_assets::Model {
            id,
            name: name.into(),
            format: format.into(),
            object_key: key,
            size_bytes: size,
            status: "pending".into(),
            created_at: chrono::Utc::now().naive_utc(),
            default_rotation_x_deg: 0.0,
            default_rotation_y_deg: 0.0,
            default_rotation_z_deg: 0.0,
            default_scale: 1.0,
            default_offset_x: 0.0,
            default_offset_y: 0.0,
            default_offset_z: 0.0,
        };
        row.clone()
            .into_active_model()
            .insert(&self.db.connection)
            .await?;
        let mut result = self.model(&row, origin).await?;
        result["upload_url"] = json!(upload);
        Ok(result)
    }
    pub async fn complete(&self, id: &str, origin: &str) -> Result<Value> {
        let tx = self.db.write().await?;
        let mut row = library_assets::Entity::find_by_id(id)
            .one(&tx)
            .await?
            .ok_or_else(|| Error::missing("Library file", id))?;
        if row.status == "pending" {
            if !self
                .storage
                .finalize(&row.object_key, row.size_bytes as u64)
                .await
                .map_err(external)?
            {
                return Err(Error::new(
                    422,
                    "http_error",
                    "Uploaded file is missing, incomplete or has an invalid format signature",
                ));
            }
            row.status = "ready".into();
            row.clone()
                .into_active_model()
                .reset_all()
                .update(&tx)
                .await?;
        }
        tx.commit().await?;
        self.model(&row, origin).await
    }
    pub async fn defaults(&self, id: &str, data: &Value, origin: &str) -> Result<Value> {
        let tx = self.db.write().await?;
        let mut row = library_assets::Entity::find_by_id(id)
            .one(&tx)
            .await?
            .ok_or_else(|| Error::missing("Library file", id))?;
        let rot: crate::models::Vec3 =
            serde_json::from_value(data["default_rotation_deg"].clone())?;
        let scale = data["default_scale"]
            .as_f64()
            .filter(|f| f.is_finite() && *f > 0.0)
            .ok_or_else(|| Error::invalid("Scale must be positive"))?;
        row.default_rotation_x_deg = rot[0];
        row.default_rotation_y_deg = rot[1];
        row.default_rotation_z_deg = rot[2];
        row.default_scale = scale;
        if let Some(value) = data.get("default_offset").filter(|v| !v.is_null()) {
            let offset: crate::models::Vec3 = serde_json::from_value(value.clone())?;
            row.default_offset_x = offset[0];
            row.default_offset_y = offset[1];
            row.default_offset_z = offset[2];
        }
        row.clone()
            .into_active_model()
            .reset_all()
            .update(&tx)
            .await?;
        tx.commit().await?;
        self.model(&row, origin).await
    }
    pub async fn delete(&self, ids: Vec<String>) -> Result<()> {
        // Keep storage staging and SQL commit/rollback alive if the HTTP caller disconnects.
        let library = self.clone();
        tokio::spawn(async move { library.delete_inner(ids).await })
            .await
            .map_err(|_| Error::new(500, "internal_error", "Deletion worker failed"))?
    }
    async fn delete_inner(&self, mut ids: Vec<String>) -> Result<()> {
        ids.sort();
        ids.dedup();
        if ids.is_empty() {
            return Err(Error::invalid("Select at least one asset"));
        }
        let tx = self.db.write().await?;
        let mut rows = vec![];
        for id in &ids {
            rows.push(
                library_assets::Entity::find_by_id(id)
                    .one(&tx)
                    .await?
                    .ok_or_else(|| Error::missing("Library file", id))?,
            );
        }
        let keys = rows
            .iter()
            .map(|r| r.object_key.clone())
            .collect::<Vec<_>>();
        let transaction = new_id();
        self.storage
            .stage_delete(&keys, &transaction)
            .await
            .map_err(external)?;
        let result = async {
            let clouds = project_clouds::Entity::find()
                .filter(project_clouds::Column::LibraryAssetId.is_in(ids.clone()))
                .all(&tx)
                .await?;
            let affected = clouds
                .iter()
                .map(|r| r.project_id.clone())
                .collect::<std::collections::BTreeSet<_>>();
            project_clouds::Entity::delete_many()
                .filter(project_clouds::Column::LibraryAssetId.is_in(ids.clone()))
                .exec(&tx)
                .await?;
            for id in affected {
                projects::Entity::update_many()
                    .col_expr(
                        projects::Column::Revision,
                        Expr::col(projects::Column::Revision).add(1),
                    )
                    .filter(projects::Column::Id.eq(&id))
                    .exec(&tx)
                    .await?;
                reorder(&tx, &id, None).await?;
            }
            library_assets::Entity::delete_many()
                .filter(library_assets::Column::Id.is_in(ids))
                .exec(&tx)
                .await?;
            tx.commit().await?;
            Ok::<_, Error>(())
        }
        .await;
        match result {
            Ok(()) => {
                if let Err(e) = self.storage.commit_delete(&keys, &transaction).await {
                    eprintln!("Could not clean unreferenced deletion staging: {e}");
                }
                Ok(())
            }
            Err(e) => {
                self.storage
                    .rollback_delete(&keys, &transaction)
                    .await
                    .map_err(external)?;
                Err(e)
            }
        }
    }
    pub async fn cloud_model<C: ConnectionTrait>(
        &self,
        db: &C,
        c: &project_clouds::Model,
        origin: &str,
    ) -> Result<Value> {
        let r = library_assets::Entity::find_by_id(&c.library_asset_id)
            .one(db)
            .await?
            .ok_or_else(|| Error::missing("Library file", &c.library_asset_id))?;
        let download = self
            .storage
            .download_url(&r.id, &r.object_key, origin)
            .await
            .map_err(external)?;
        Ok(
            json!({"id":c.id,"project_id":c.project_id,"library_asset_id":r.id,"name":r.name,"format":r.format,"position":c.position,"visible":c.visible,"download_url":download,"translation":[c.translation_x,c.translation_y,c.translation_z],"rotation_deg":[c.rotation_x_deg,c.rotation_y_deg,c.rotation_z_deg],"scale":c.scale,"offset":[c.offset_x,c.offset_y,c.offset_z]}),
        )
    }
    pub async fn clouds(&self, id: &str, origin: &str) -> Result<(Value, i64)> {
        let p = database::load(&self.db.connection, id).await?;
        let rows = project_clouds::Entity::find()
            .filter(project_clouds::Column::ProjectId.eq(id))
            .order_by_asc(project_clouds::Column::Position)
            .all(&self.db.connection)
            .await?;
        let mut out = vec![];
        for row in rows {
            out.push(self.cloud_model(&self.db.connection, &row, origin).await?);
        }
        Ok((json!(out), p.revision))
    }
    pub async fn cloud_mutate(
        &self,
        id: &str,
        expected: i64,
        cloud: Option<&str>,
        data: Option<&Value>,
        origin: &str,
    ) -> Result<(Value, i64)> {
        let tx = self.db.write().await?;
        let p = database::load(&tx, id).await?;
        crate::service::check_revision(&p, expected)?;
        let row = if let Some(cloud) = cloud {
            let mut c = project_clouds::Entity::find_by_id(cloud)
                .filter(project_clouds::Column::ProjectId.eq(id))
                .one(&tx)
                .await?
                .ok_or_else(|| Error::missing("Project cloud", cloud))?;
            if let Some(data) = data {
                let position = data
                    .get("position")
                    .filter(|v| !v.is_null())
                    .map(|v| v.as_u64().ok_or_else(|| Error::invalid("Invalid position")))
                    .transpose()?;
                let visible = data
                    .get("visible")
                    .filter(|v| !v.is_null())
                    .map(|v| {
                        v.as_bool()
                            .ok_or_else(|| Error::invalid("Invalid visibility"))
                    })
                    .transpose()?;
                if position.is_none() && visible.is_none() {
                    return Err(Error::invalid("Specify position or visibility"));
                }
                if let Some(position) = position {
                    reorder(&tx, id, Some((&c.id, position as usize))).await?;
                    c.position = position as i64;
                }
                if let Some(visible) = visible {
                    c.visible = visible;
                }
                c.clone()
                    .into_active_model()
                    .reset_all()
                    .update(&tx)
                    .await?;
                Some(c)
            } else {
                project_clouds::Entity::delete_by_id(cloud)
                    .exec(&tx)
                    .await?;
                reorder(&tx, id, None).await?;
                None
            }
        } else {
            let data = data.ok_or_else(|| Error::invalid("Missing cloud data"))?;
            let asset = data["library_asset_id"]
                .as_str()
                .ok_or_else(|| Error::invalid("Missing library asset"))?;
            let r = library_assets::Entity::find_by_id(asset)
                .filter(library_assets::Column::Status.eq("ready"))
                .one(&tx)
                .await?
                .ok_or_else(|| Error::missing("Library asset", asset))?;
            let translation: crate::models::Vec3 = serde_json::from_value(
                data.get("translation")
                    .cloned()
                    .unwrap_or_else(|| json!([0, 0, 0])),
            )?;
            let count = project_clouds::Entity::find()
                .filter(project_clouds::Column::ProjectId.eq(id))
                .all(&tx)
                .await?
                .len();
            let c = project_clouds::Model {
                id: new_id(),
                project_id: id.into(),
                library_asset_id: r.id,
                position: count as i64,
                visible: true,
                translation_x: translation[0],
                translation_y: translation[1],
                translation_z: translation[2],
                rotation_x_deg: r.default_rotation_x_deg,
                rotation_y_deg: r.default_rotation_y_deg,
                rotation_z_deg: r.default_rotation_z_deg,
                scale: r.default_scale,
                offset_x: r.default_offset_x,
                offset_y: r.default_offset_y,
                offset_z: r.default_offset_z,
            };
            c.clone().into_active_model().insert(&tx).await?;
            Some(c)
        };
        projects::Entity::update_many()
            .col_expr(projects::Column::Revision, Expr::value(expected + 1))
            .filter(projects::Column::Id.eq(id))
            .filter(projects::Column::Revision.eq(expected))
            .exec(&tx)
            .await?;
        let value = if let Some(row) = row {
            self.cloud_model(&tx, &row, origin).await?
        } else {
            Value::Null
        };
        tx.commit().await?;
        Ok((value, expected + 1))
    }
}
async fn reorder<C: ConnectionTrait>(db: &C, id: &str, moved: Option<(&str, usize)>) -> Result<()> {
    let mut rows = project_clouds::Entity::find()
        .filter(project_clouds::Column::ProjectId.eq(id))
        .order_by_asc(project_clouds::Column::Position)
        .all(db)
        .await?;
    if let Some((cloud, position)) = moved {
        if position >= rows.len() {
            return Err(Error::new(
                422,
                "http_error",
                "Cloud position is out of range",
            ));
        }
        let index = rows
            .iter()
            .position(|r| r.id == cloud)
            .ok_or_else(|| Error::missing("cloud", cloud))?;
        let row = rows.remove(index);
        rows.insert(position, row);
    }
    project_clouds::Entity::update_many()
        .col_expr(
            project_clouds::Column::Position,
            Expr::col(project_clouds::Column::Position).mul(-1).sub(1),
        )
        .filter(project_clouds::Column::ProjectId.eq(id))
        .exec(db)
        .await?;
    for (index, row) in rows.iter().enumerate() {
        project_clouds::ActiveModel {
            id: Set(row.id.clone()),
            position: Set(index as i64),
            ..Default::default()
        }
        .update(db)
        .await?;
    }
    Ok(())
}
