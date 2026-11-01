use crate::{Error, Result, entities::*, models::*};
use sea_orm::{
    ActiveValue::Set, ConnectOptions, ConnectionTrait, Database, DatabaseConnection,
    DatabaseTransaction, DbBackend, IntoActiveModel, QueryOrder, Statement, TransactionTrait,
    entity::prelude::*,
};
use sea_orm_migration::prelude::{MigrationName, MigrationTrait, MigratorTrait, SchemaManager};
use serde_json::{Value, json};
use std::time::Duration;

#[derive(Clone)]
pub struct Db {
    pub connection: DatabaseConnection,
}
impl Db {
    pub async fn connect(url: &str) -> Result<Self> {
        let url = normalize_url(url);
        if !url.contains(":memory:") {
            let path = url
                .split('?')
                .next()
                .unwrap()
                .strip_prefix("sqlite://")
                .ok_or_else(|| Error::invalid("Only SQLite is supported"))?;
            if let Some(parent) = std::path::Path::new(path)
                .parent()
                .filter(|p| !p.as_os_str().is_empty())
            {
                tokio::fs::create_dir_all(parent).await.map_err(|_| {
                    Error::new(500, "internal_error", "Cannot create database directory")
                })?;
            }
        }
        let mut options = ConnectOptions::new(url);
        options
            .max_connections(1)
            .min_connections(1)
            .connect_timeout(Duration::from_secs(10))
            .sqlx_logging(false);
        let connection = Database::connect(options).await?;
        connection
            .execute_unprepared("PRAGMA foreign_keys=ON")
            .await?;
        connection
            .execute_unprepared("PRAGMA busy_timeout=10000")
            .await?;
        Ok(Self { connection })
    }
    /// Take SQLite's write lock before reading, including across independent workers.
    pub async fn write(&self) -> Result<DatabaseTransaction> {
        let tx = self.connection.begin().await?;
        tx.execute_unprepared("UPDATE projects SET revision=revision WHERE 0")
            .await?;
        Ok(tx)
    }
    pub async fn migrate(&self) -> anyhow::Result<()> {
        let existing = self
            .connection
            .query_one_raw(Statement::from_string(
                DbBackend::Sqlite,
                "SELECT name FROM sqlite_master WHERE type='table' AND name='projects'".to_string(),
            ))
            .await?
            .is_some();
        if existing {
            let sea = self
                .connection
                .query_one_raw(Statement::from_string(
                    DbBackend::Sqlite,
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='seaql_migrations'"
                        .to_string(),
                ))
                .await?
                .is_some();
            if !sea {
                let row = self
                    .connection
                    .query_one_raw(Statement::from_string(
                        DbBackend::Sqlite,
                        "SELECT version_num FROM alembic_version".to_string(),
                    ))
                    .await?
                    .ok_or_else(|| anyhow::anyhow!("Missing Alembic schema version"))?;
                let version: String = row.try_get("", "version_num")?;
                anyhow::ensure!(
                    version == "20261026_0014",
                    "Unsupported Alembic schema {version}; upgrade Python schema to 20261026_0014 first"
                );
            }
            // Refuse a falsely stamped or incomplete database. No records are rewritten during adoption.
            let schema: Value = serde_json::from_str(include_str!("legacy_schema.json"))?;
            for (table, columns) in schema.as_object().unwrap() {
                let rows = self
                    .connection
                    .query_all_raw(Statement::from_string(
                        DbBackend::Sqlite,
                        format!("PRAGMA table_info(\"{table}\")"),
                    ))
                    .await?;
                let names: std::collections::BTreeSet<String> = rows
                    .iter()
                    .map(|r| r.try_get("", "name"))
                    .collect::<std::result::Result<_, _>>()?;
                let expected: std::collections::BTreeSet<String> = columns
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|c| c["name"].as_str().unwrap().to_string())
                    .collect();
                anyhow::ensure!(
                    names == expected,
                    "Unexpected columns in table {table}; migration aborted"
                );
                for row in &rows {
                    let name: String = row.try_get("", "name")?;
                    let actual_type: String = row.try_get("", "type")?;
                    let primary: i64 = row.try_get("", "pk")?;
                    let not_null: i64 = row.try_get("", "notnull")?;
                    let expected = columns
                        .as_array()
                        .unwrap()
                        .iter()
                        .find(|c| c["name"] == name)
                        .unwrap();
                    anyhow::ensure!(
                        affinity(&actual_type) == affinity(expected["type"].as_str().unwrap()),
                        "Unexpected type for {table}.{name}; migration aborted"
                    );
                    anyhow::ensure!(
                        (primary > 0) == expected["primary"].as_bool().unwrap(),
                        "Unexpected primary key for {table}.{name}; migration aborted"
                    );
                    anyhow::ensure!(
                        (not_null == 0) == expected["nullable"].as_bool().unwrap(),
                        "Unexpected nullability for {table}.{name}; migration aborted"
                    );
                }
                let expected_fks: Value =
                    serde_json::from_str(include_str!("legacy_foreign_keys.json"))?;
                let rows = self
                    .connection
                    .query_all_raw(Statement::from_string(
                        DbBackend::Sqlite,
                        format!("PRAGMA foreign_key_list(\"{table}\")"),
                    ))
                    .await?;
                let mut actual = Vec::<Vec<String>>::new();
                for row in rows {
                    let mut fields = vec![];
                    for key in ["table", "from", "to", "on_delete", "on_update"] {
                        fields.push(row.try_get::<String>("", key)?);
                    }
                    actual.push(fields);
                }
                actual.sort();
                anyhow::ensure!(
                    json!(actual) == expected_fks[table],
                    "Unexpected foreign keys in table {table}; migration aborted"
                );
            }
        }
        let corrupt = self
            .connection
            .query_all_raw(Statement::from_string(
                DbBackend::Sqlite,
                "PRAGMA foreign_key_check".to_string(),
            ))
            .await?;
        anyhow::ensure!(
            corrupt.is_empty(),
            "Foreign key violations found; migration aborted"
        );
        Migrator::up(&self.connection, None).await?;
        Ok(())
    }
}
pub struct Migrator;
#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![Box::new(AdoptLegacy)]
    }
}
pub struct AdoptLegacy;
impl MigrationName for AdoptLegacy {
    fn name(&self) -> &str {
        "m20261031_0001_adopt_alembic_0014"
    }
}
#[async_trait::async_trait]
impl MigrationTrait for AdoptLegacy {
    async fn up(&self, manager: &SchemaManager) -> std::result::Result<(), DbErr> {
        let connection = manager.get_connection();
        if !manager.has_table("projects").await? {
            connection
                .execute_unprepared(include_str!("legacy_schema.sql"))
                .await?;
            connection.execute_unprepared("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL PRIMARY KEY); INSERT INTO alembic_version VALUES ('20261026_0014');").await?;
        }
        connection.execute_unprepared("CREATE TABLE processed_commands (id TEXT NOT NULL PRIMARY KEY, payload_digest TEXT NOT NULL, processed_at INTEGER NOT NULL)").await?;
        Ok(())
    }
    async fn down(&self, _: &SchemaManager) -> std::result::Result<(), DbErr> {
        Err(DbErr::Custom("Rollback is a documented restore of the pre-migration SQLite/file backup; automatic data removal is disabled".into()))
    }
}
fn text<T: serde::Serialize>(value: T) -> String {
    serde_json::to_value(value)
        .unwrap()
        .as_str()
        .unwrap()
        .into()
}
fn aim(kind: String, direction: Option<String>, point: Option<String>) -> Result<Aim> {
    Ok(if kind == "follow_path" {
        Aim::FollowPath {
            direction: serde_json::from_value(json!(
                direction.unwrap_or_else(|| "forward".into())
            ))?,
        }
    } else {
        Aim::LookAtPoint {
            scene_point_id: point.ok_or_else(|| Error::invalid("Missing scene point"))?,
        }
    })
}
fn aim_fields(aim: &Aim) -> (String, Option<String>, Option<String>) {
    match aim {
        Aim::FollowPath { direction } => ("follow_path".into(), Some(text(direction)), None),
        Aim::LookAtPoint { scene_point_id } => {
            ("look_at_point".into(), None, Some(scene_point_id.clone()))
        }
    }
}

pub async fn load<C: ConnectionTrait>(db: &C, id: &str) -> Result<Project> {
    let row = projects::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| Error::missing("project", id))?;
    let mut p = Project::new(row.name);
    p.id = row.id;
    p.revision = row.revision;
    for r in anchors::Entity::find()
        .filter(anchors::Column::ProjectId.eq(id))
        .all(db)
        .await?
    {
        let a = Anchor {
            id: r.id.clone(),
            label: r.label,
            surface_position: [
                r.surface_position_x,
                r.surface_position_y,
                r.surface_position_z,
            ],
            surface_normal: [r.surface_normal_x, r.surface_normal_y, r.surface_normal_z],
            lift: r.lift,
            lift_axis: serde_json::from_value(json!(r.lift_axis))?,
        };
        p.anchors.insert(r.id, a);
    }
    for r in scene_points::Entity::find()
        .filter(scene_points::Column::ProjectId.eq(id))
        .all(db)
        .await?
    {
        p.scene_points.insert(
            r.id.clone(),
            ScenePoint {
                id: r.id,
                label: r.label,
                position: [r.position_x, r.position_y, r.position_z],
            },
        );
    }
    for r in trajectory_segments::Entity::find()
        .filter(trajectory_segments::Column::ProjectId.eq(id))
        .order_by_asc(trajectory_segments::Column::Position)
        .all(db)
        .await?
    {
        let ids = segment_anchors::Entity::find()
            .filter(segment_anchors::Column::SegmentId.eq(&r.id))
            .order_by_asc(segment_anchors::Column::Position)
            .all(db)
            .await?
            .into_iter()
            .map(|v| v.anchor_id)
            .collect::<Vec<_>>();
        p.segments.push(if r.kind == "spline" {
            Segment::Spline {
                id: r.id,
                anchor_ids: ids,
                tension: r.tension.unwrap_or(0.0),
            }
        } else {
            if ids.len() != 3 {
                return Err(Error::invalid("Invalid persisted spiral"));
            }
            Segment::Spiral {
                id: r.id,
                start_anchor_id: ids[0].clone(),
                center_anchor_id: ids[1].clone(),
                end_anchor_id: ids[2].clone(),
                turns: r.turns.unwrap_or(1.0),
                direction: serde_json::from_value(json!(
                    r.direction.unwrap_or_else(|| "ccw".into())
                ))?,
                radial_law: serde_json::from_value(json!(
                    r.radial_law.unwrap_or_else(|| "smoothstep".into())
                ))?,
                axial_law: serde_json::from_value(json!(
                    r.axial_law.unwrap_or_else(|| "smoothstep".into())
                ))?,
            }
        });
    }
    if let Some(r) = motion_profiles::Entity::find_by_id(id).one(db).await? {
        p.motion_profile.default_speed = r.default_speed;
    }
    for r in speed_keyframes::Entity::find()
        .filter(speed_keyframes::Column::ProjectId.eq(id))
        .all(db)
        .await?
    {
        p.motion_profile.keyframes.insert(
            r.id.clone(),
            SpeedKeyframe {
                id: r.id,
                path_position: r.path_position,
                speed: r.speed,
                interpolation_to_next: serde_json::from_value(json!(r.interpolation_to_next))?,
            },
        );
    }
    if let Some(r) = camera_tracks::Entity::find_by_id(id).one(db).await? {
        p.camera_track.default_aim = aim(
            r.default_aim_kind,
            r.default_aim_direction,
            r.default_aim_scene_point_id,
        )?;
        p.camera_track.world_up = [r.world_up_x, r.world_up_y, r.world_up_z];
        p.camera_track.default_orientation = Orientation {
            yaw_deg: r.default_orientation_yaw_deg,
            pitch_deg: r.default_orientation_pitch_deg,
            roll_deg: r.default_orientation_roll_deg,
        };
    }
    for r in aim_keyframes::Entity::find()
        .filter(aim_keyframes::Column::ProjectId.eq(id))
        .all(db)
        .await?
    {
        p.camera_track.keyframes.insert(
            r.id.clone(),
            AimKeyframe {
                id: r.id,
                path_position: r.path_position,
                aim: aim(r.aim_kind, r.aim_direction, r.aim_scene_point_id)?,
                interpolation_to_next: serde_json::from_value(json!(r.interpolation_to_next))?,
            },
        );
    }
    for r in orientation_keyframes::Entity::find()
        .filter(orientation_keyframes::Column::ProjectId.eq(id))
        .all(db)
        .await?
    {
        p.camera_track.orientation_keyframes.insert(
            r.id.clone(),
            OrientationKeyframe {
                id: r.id,
                path_position: r.path_position,
                orientation: Orientation {
                    yaw_deg: r.yaw_deg,
                    pitch_deg: r.pitch_deg,
                    roll_deg: r.roll_deg,
                },
                interpolation_to_next: serde_json::from_value(json!(r.interpolation_to_next))?,
            },
        );
    }
    for r in depth_of_field_keyframes::Entity::find()
        .filter(depth_of_field_keyframes::Column::ProjectId.eq(id))
        .all(db)
        .await?
    {
        p.camera_track.depth_of_field_keyframes.insert(
            r.id.clone(),
            DofKeyframe {
                id: r.id,
                path_position: r.path_position,
                focus: if r.focus_kind == "scene_point" {
                    Focus::ScenePoint {
                        scene_point_id: r
                            .focus_scene_point_id
                            .ok_or_else(|| Error::invalid("Invalid focus"))?,
                    }
                } else {
                    Focus::CenterWeighted9
                },
                focus_range_scale: r.focus_range_scale,
                bokeh_scale: r.bokeh_scale,
            },
        );
    }
    if let Some(r) = lidar_keyframes::Entity::find_by_id(id).one(db).await? {
        p.camera_track.lidar_keyframe = Some(LidarKeyframe {
            id: r.id,
            path_position: 0.0,
            vertical_fov_deg: r.vertical_fov_deg,
            horizontal_resolution: r.horizontal_resolution,
            vertical_resolution: r.vertical_resolution,
        });
    }
    for r in chat_messages::Entity::find()
        .filter(chat_messages::Column::ProjectId.eq(id))
        .order_by_asc(chat_messages::Column::Position)
        .all(db)
        .await?
    {
        p.chat_history.push(ChatMessage {
            id: r.id,
            role: serde_json::from_value(json!(r.role))?,
            content: r.content,
        });
    }
    Ok(p)
}
macro_rules! insert_row {
    ($db:expr,$entity:ident,$value:expr) => {{
        let model: $entity::Model = serde_json::from_value($value)?;
        model.into_active_model().insert($db).await?;
    }};
}
/// Replace aggregate resources in one transaction. IDs remain stable; unrelated cloud instances remain untouched.
pub async fn store<C: ConnectionTrait>(db: &C, p: &Project) -> Result<()> {
    macro_rules! clear {
        ($entity:ident) => {
            $entity::Entity::delete_many()
                .filter($entity::Column::ProjectId.eq(&p.id))
                .exec(db)
                .await?;
        };
    }
    clear!(aim_keyframes);
    clear!(depth_of_field_keyframes);
    clear!(orientation_keyframes);
    clear!(speed_keyframes);
    clear!(lidar_keyframes);
    clear!(chat_messages);
    clear!(camera_tracks);
    clear!(motion_profiles);
    clear!(trajectory_segments);
    clear!(anchors);
    clear!(scene_points);
    for a in p.anchors.values() {
        insert_row!(
            db,
            anchors,
            json!({"id":a.id,"project_id":p.id,"label":a.label,"surface_position_x":a.surface_position[0],"surface_position_y":a.surface_position[1],"surface_position_z":a.surface_position[2],"surface_normal_x":a.surface_normal[0],"surface_normal_y":a.surface_normal[1],"surface_normal_z":a.surface_normal[2],"lift":a.lift,"lift_axis":a.lift_axis})
        );
    }
    for a in p.scene_points.values() {
        insert_row!(
            db,
            scene_points,
            json!({"id":a.id,"project_id":p.id,"label":a.label,"position_x":a.position[0],"position_y":a.position[1],"position_z":a.position[2]})
        );
    }
    for (position, s) in p.segments.iter().enumerate() {
        let mut row = json!({"id":s.id(),"project_id":p.id,"position":position,"kind":"spline","tension":null,"turns":null,"direction":null,"radial_law":null,"axial_law":null});
        match s {
            Segment::Spline { tension, .. } => {
                row["tension"] = json!(tension);
            }
            Segment::Spiral {
                turns,
                direction,
                radial_law,
                axial_law,
                ..
            } => {
                row["kind"] = json!("spiral");
                row["turns"] = json!(turns);
                row["direction"] = json!(direction);
                row["radial_law"] = json!(radial_law);
                row["axial_law"] = json!(axial_law);
            }
        }
        insert_row!(db, trajectory_segments, row);
        for (index, a) in s.anchors().iter().enumerate() {
            insert_row!(
                db,
                segment_anchors,
                json!({"segment_id":s.id(),"position":index,"anchor_id":a})
            );
        }
    }
    insert_row!(
        db,
        motion_profiles,
        json!({"project_id":p.id,"default_speed":p.motion_profile.default_speed})
    );
    for a in p.motion_profile.keyframes.values() {
        insert_row!(
            db,
            speed_keyframes,
            json!({"id":a.id,"project_id":p.id,"path_position":a.path_position,"speed":a.speed,"interpolation_to_next":a.interpolation_to_next})
        );
    }
    let c = &p.camera_track;
    let (kind, direction, point) = aim_fields(&c.default_aim);
    insert_row!(
        db,
        camera_tracks,
        json!({"project_id":p.id,"default_aim_kind":kind,"default_aim_direction":direction,"default_aim_scene_point_id":point,"world_up_x":c.world_up[0],"world_up_y":c.world_up[1],"world_up_z":c.world_up[2],"default_orientation_yaw_deg":c.default_orientation.yaw_deg,"default_orientation_pitch_deg":c.default_orientation.pitch_deg,"default_orientation_roll_deg":c.default_orientation.roll_deg})
    );
    for a in c.keyframes.values() {
        let (kind, direction, point) = aim_fields(&a.aim);
        insert_row!(
            db,
            aim_keyframes,
            json!({"id":a.id,"project_id":p.id,"path_position":a.path_position,"aim_kind":kind,"aim_direction":direction,"aim_scene_point_id":point,"interpolation_to_next":a.interpolation_to_next})
        );
    }
    for a in c.orientation_keyframes.values() {
        insert_row!(
            db,
            orientation_keyframes,
            json!({"id":a.id,"project_id":p.id,"path_position":a.path_position,"yaw_deg":a.orientation.yaw_deg,"pitch_deg":a.orientation.pitch_deg,"roll_deg":a.orientation.roll_deg,"interpolation_to_next":a.interpolation_to_next})
        );
    }
    for a in c.depth_of_field_keyframes.values() {
        let (kind, point) = match &a.focus {
            Focus::CenterWeighted9 => ("center_weighted_9", None),
            Focus::ScenePoint { scene_point_id } => ("scene_point", Some(scene_point_id)),
        };
        insert_row!(
            db,
            depth_of_field_keyframes,
            json!({"id":a.id,"project_id":p.id,"path_position":a.path_position,"focus_kind":kind,"focus_scene_point_id":point,"focus_range_scale":a.focus_range_scale,"bokeh_scale":a.bokeh_scale})
        );
    }
    if let Some(a) = &c.lidar_keyframe {
        insert_row!(
            db,
            lidar_keyframes,
            json!({"project_id":p.id,"id":a.id,"vertical_fov_deg":a.vertical_fov_deg,"horizontal_resolution":a.horizontal_resolution,"vertical_resolution":a.vertical_resolution})
        );
    }
    for (position, a) in p.chat_history.iter().enumerate() {
        insert_row!(
            db,
            chat_messages,
            json!({"id":a.id,"project_id":p.id,"position":position,"role":a.role,"content":a.content})
        );
    }
    Ok(())
}
pub async fn create(db: &Db, p: &Project) -> Result<()> {
    let tx = db.write().await?;
    projects::ActiveModel {
        id: Set(p.id.clone()),
        name: Set(p.name.clone()),
        revision: Set(p.revision),
    }
    .insert(&tx)
    .await?;
    store(&tx, p).await?;
    tx.commit().await?;
    Ok(())
}
pub async fn save<C: ConnectionTrait>(db: &C, p: &Project, expected: i64) -> Result<()> {
    let changed = projects::Entity::update_many()
        .col_expr(projects::Column::Name, Expr::value(p.name.clone()))
        .col_expr(projects::Column::Revision, Expr::value(p.revision))
        .filter(projects::Column::Id.eq(&p.id))
        .filter(projects::Column::Revision.eq(expected))
        .exec(db)
        .await?;
    if changed.rows_affected != 1 {
        return Err(Error::conflict("Project revision changed"));
    }
    store(db, p).await
}

fn affinity(ty: &str) -> &'static str {
    let ty = ty.to_uppercase();
    if ty.contains("INT") {
        "integer"
    } else if ["CHAR", "CLOB", "TEXT"].iter().any(|s| ty.contains(s)) {
        "text"
    } else if ["REAL", "FLOA", "DOUB"].iter().any(|s| ty.contains(s)) {
        "real"
    } else if ty.is_empty() || ty.contains("BLOB") {
        "blob"
    } else {
        "numeric"
    }
}
fn normalize_url(url: &str) -> String {
    let url = if let Some(path) = url.strip_prefix("sqlite+aiosqlite:///") {
        format!("sqlite://{path}")
    } else {
        url.to_string()
    };
    if url.contains(":memory:")
        || url
            .split('?')
            .nth(1)
            .is_some_and(|q| q.split('&').any(|p| p.starts_with("mode=")))
    {
        url
    } else {
        format!("{url}{}mode=rwc", if url.contains('?') { "&" } else { "?" })
    }
}
#[cfg(test)]
mod tests {
    use super::normalize_url;
    #[test]
    fn sqlalchemy_paths_keep_relative_and_absolute_meanings() {
        assert_eq!(
            normalize_url("sqlite+aiosqlite:///./relative.sqlite3"),
            "sqlite://./relative.sqlite3?mode=rwc"
        );
        assert_eq!(
            normalize_url("sqlite+aiosqlite:////tmp/absolute.sqlite3"),
            "sqlite:///tmp/absolute.sqlite3?mode=rwc"
        );
        assert_eq!(
            normalize_url("sqlite+aiosqlite:///:memory:"),
            "sqlite://:memory:"
        );
        assert_eq!(
            normalize_url("sqlite:///db?mode=ro"),
            "sqlite:///db?mode=ro"
        );
    }
}
