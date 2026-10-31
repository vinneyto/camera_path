use crate::{
    Error, Result,
    database::{self, Db},
    entities::{project_clouds, projects, user_settings},
    geometry,
    models::*,
};
use indexmap::IndexMap;
use sea_orm::{ActiveValue::Set, QueryOrder, entity::prelude::*};
use serde_json::{Value, json};
#[derive(Clone, Copy, Debug)]
pub enum Resource {
    Anchor,
    ScenePoint,
    Segments,
    Motion,
    Aim,
    Orientation,
    Dof,
    Lidar,
    Chat,
}
#[derive(Clone, Debug)]
pub enum Action {
    Create(Value),
    Update(String, Value),
    Delete(String),
    Clear,
}
#[derive(Clone, Debug)]
pub enum Command {
    Edit(Resource, Action),
    Rename(String),
    Reset,
    UserMessage { id: String, content: String },
}
#[derive(Clone)]
pub struct Core {
    pub db: Db,
    pub tolerance: f64,
}
impl Core {
    pub async fn get(&self, id: &str) -> Result<Project> {
        use sea_orm::TransactionTrait;
        let tx = self.db.connection.begin().await?;
        let project = database::load(&tx, id).await?;
        tx.commit().await?;
        Ok(project)
    }
    pub async fn list(&self) -> Result<Vec<Project>> {
        let rows = projects::Entity::find()
            .order_by_asc(projects::Column::Id)
            .all(&self.db.connection)
            .await?;
        let mut out = vec![];
        for row in rows {
            out.push(self.get(&row.id).await?);
        }
        Ok(out)
    }
    pub async fn create(&self, name: String) -> Result<Project> {
        let p = Project::new(name);
        geometry::validate(&p)?;
        database::create(&self.db, &p).await?;
        Ok(p)
    }
    pub async fn delete(&self, id: &str, expected: i64) -> Result<i64> {
        let tx = self.db.write().await?;
        let p = database::load(&tx, id).await?;
        check_revision(&p, expected)?;
        projects::Entity::delete_by_id(id).exec(&tx).await?;
        tx.commit().await?;
        Ok(p.revision)
    }
    pub async fn mutate(
        &self,
        id: &str,
        expected: i64,
        command: Command,
    ) -> Result<(Project, Value)> {
        let tx = self.db.write().await?;
        let p = database::load(&tx, id).await?;
        check_revision(&p, expected)?;
        let reset = matches!(command, Command::Reset);
        let compile_spiral = matches!(&command,Command::Edit(Resource::Segments,Action::Create(value)) if value["kind"]=="spiral");
        let tolerance = self.tolerance;
        let (mut draft, value, changed) = tokio::task::spawn_blocking(move || -> Result<_> {
            let mut draft = p;
            let (value, changed) = apply(&mut draft, command)?;
            geometry::validate(&draft)?;
            if compile_spiral {
                geometry::compile(&draft, tolerance)?;
            }
            Ok((draft, value, changed))
        })
        .await
        .map_err(|_| Error::new(500, "internal_error", "Domain operation failed"))??;
        if changed {
            draft.revision = expected + 1;
            database::save(&tx, &draft, expected).await?;
            if reset {
                project_clouds::Entity::delete_many()
                    .filter(project_clouds::Column::ProjectId.eq(id))
                    .exec(&tx)
                    .await?;
            }
        }
        tx.commit().await?;
        Ok((draft, value))
    }
    pub async fn compiled(&self, id: &str) -> Result<Compiled> {
        self.compile(self.get(id).await?).await
    }
    pub async fn compile(&self, p: Project) -> Result<Compiled> {
        let tol = self.tolerance;
        tokio::task::spawn_blocking(move || geometry::compile(&p, tol))
            .await
            .map_err(|_| Error::new(500, "internal_error", "Trajectory compilation failed"))?
    }
    pub async fn settings(&self, id: &str) -> Result<Value> {
        let row = user_settings::Entity::find_by_id(id)
            .one(&self.db.connection)
            .await?;
        Ok(row.map(|r|json!({"show_grid":r.show_grid,"gaussian_dpr":r.gaussian_dpr,"webgpu_tile_renderer":r.webgpu_tile_renderer})).unwrap_or_else(||json!({"show_grid":true,"gaussian_dpr":"1x","webgpu_tile_renderer":false})))
    }
    pub async fn update_settings(&self, id: &str, patch: &Value) -> Result<Value> {
        let tx = self.db.write().await?;
        let mut row = user_settings::Entity::find_by_id(id)
            .one(&tx)
            .await?
            .unwrap_or_else(|| user_settings::Model {
                user_id: id.into(),
                show_grid: true,
                webgpu_tile_renderer: false,
                gaussian_dpr: "1x".into(),
            });
        for (key, value) in patch
            .as_object()
            .ok_or_else(|| Error::invalid("Expected settings object"))?
        {
            match key.as_str() {
                "show_grid" => {
                    row.show_grid = value
                        .as_bool()
                        .ok_or_else(|| Error::invalid("Expected boolean"))?
                }
                "webgpu_tile_renderer" => {
                    row.webgpu_tile_renderer = value
                        .as_bool()
                        .ok_or_else(|| Error::invalid("Expected boolean"))?
                }
                "gaussian_dpr" if value == "1x" || value == "system" => {
                    row.gaussian_dpr = value.as_str().unwrap().into()
                }
                _ => return Err(Error::invalid("Unknown or invalid viewer setting")),
            }
        }
        user_settings::Entity::delete_by_id(id).exec(&tx).await?;
        user_settings::ActiveModel {
            user_id: Set(row.user_id),
            show_grid: Set(row.show_grid),
            webgpu_tile_renderer: Set(row.webgpu_tile_renderer),
            gaussian_dpr: Set(row.gaussian_dpr),
        }
        .insert(&tx)
        .await?;
        tx.commit().await?;
        self.settings(id).await
    }
}
pub fn check_revision(p: &Project, expected: i64) -> Result<()> {
    if p.revision != expected {
        return Err(Error::conflict(format!(
            "expected revision {expected}, current revision is {}",
            p.revision
        )));
    }
    Ok(())
}
pub fn metadata(p: &Project) -> Value {
    json!({"id":p.id,"name":p.name,"revision":p.revision,"anchor_count":p.anchors.len(),"segment_count":p.segments.len()})
}
pub fn view(p: &Project, resource: Resource) -> Value {
    match resource {
        Resource::Anchor => json!(p.anchors.values().collect::<Vec<_>>()),
        Resource::ScenePoint => json!(p.scene_points.values().collect::<Vec<_>>()),
        Resource::Segments => json!({"segments":p.segments}),
        Resource::Motion => json!(p.motion_profile),
        Resource::Aim => {
            json!({"default_aim":p.camera_track.default_aim,"keyframes":p.camera_track.keyframes,"world_up":p.camera_track.world_up})
        }
        Resource::Orientation => {
            json!({"default_orientation":p.camera_track.default_orientation,"keyframes":p.camera_track.orientation_keyframes})
        }
        Resource::Dof => json!({"keyframes":p.camera_track.depth_of_field_keyframes}),
        Resource::Lidar => json!({"lidar_keyframe":p.camera_track.lidar_keyframe}),
        Resource::Chat => json!(p.chat_history),
    }
}
fn edit_map<T: serde::Serialize + serde::de::DeserializeOwned>(
    items: &mut IndexMap<String, T>,
    action: Action,
    label: &str,
) -> Result<Value> {
    match action {
        Action::Create(mut value) => {
            value["id"] = json!(new_id());
            let id = value["id"].as_str().unwrap().to_string();
            let item: T = serde_json::from_value(value)?;
            let result = json!(item);
            items.insert(id, item);
            Ok(result)
        }
        Action::Update(id, changes) => {
            let old = items.get(&id).ok_or_else(|| Error::missing(label, &id))?;
            let changed: T = patch(old, &changes)?;
            let result = json!(changed);
            items.insert(id, changed);
            Ok(result)
        }
        Action::Delete(id) => {
            items
                .shift_remove(&id)
                .ok_or_else(|| Error::missing(label, &id))?;
            Ok(Value::Null)
        }
        Action::Clear => {
            items.clear();
            Ok(Value::Null)
        }
    }
}
pub fn delete_scene_point(p: &mut Project, id: &str, cascade: bool) -> Result<Value> {
    if !p.scene_points.contains_key(id) {
        return Err(Error::missing("scene point", id));
    }
    if matches!(&p.camera_track.default_aim,Aim::LookAtPoint{scene_point_id} if scene_point_id==id)
    {
        return Err(Error::new(
            409,
            "reference_conflict",
            "Scene point is used by the default camera aim",
        ));
    }
    let aims = p
        .camera_track
        .keyframes
        .values()
        .filter(|k| matches!(&k.aim,Aim::LookAtPoint{scene_point_id} if scene_point_id==id))
        .map(|k| k.id.clone())
        .collect::<Vec<_>>();
    let dofs = p
        .camera_track
        .depth_of_field_keyframes
        .values()
        .filter(|k| matches!(&k.focus,Focus::ScenePoint{scene_point_id} if scene_point_id==id))
        .map(|k| k.id.clone())
        .collect::<Vec<_>>();
    if (!aims.is_empty() || !dofs.is_empty()) && !cascade {
        return Err(Error::new(
            409,
            "reference_conflict",
            "Scene point is used by camera or depth of field keyframes",
        ));
    }
    for key in aims {
        p.camera_track.keyframes.shift_remove(&key);
    }
    for key in dofs {
        p.camera_track.depth_of_field_keyframes.shift_remove(&key);
    }
    Ok(json!(p.scene_points.shift_remove(id)))
}
pub fn apply(p: &mut Project, command: Command) -> Result<(Value, bool)> {
    let result = match command {
        Command::Rename(name) => {
            p.name = name;
            Value::Null
        }
        Command::Reset => {
            let mut fresh = Project::new(p.name.clone());
            fresh.id = p.id.clone();
            fresh.revision = p.revision;
            *p = fresh;
            Value::Null
        }
        Command::UserMessage { id, content } => {
            if content.is_empty() || content.chars().count() > 10_000 {
                return Err(Error::invalid("Message must contain 1 to 10000 characters"));
            }
            if let Some(old) = p.chat_history.iter().find(|m| m.id == id) {
                if old.role != Role::User || old.content != content {
                    return Err(Error::new(
                        409,
                        "chat_message_conflict",
                        "Chat message ID is already used",
                    ));
                }
                return Ok((json!(old), false));
            }
            let item = ChatMessage {
                id,
                role: Role::User,
                content,
            };
            let result = json!(item);
            p.chat_history.push(item);
            result
        }
        Command::Edit(resource, action) => match resource {
            Resource::Anchor => {
                if let Action::Delete(id) = &action
                    && p.segments
                        .iter()
                        .any(|s| s.anchors().contains(&id.as_str()))
                {
                    return Err(Error::new(
                        409,
                        "reference_conflict",
                        "Anchor is used by a segment",
                    ));
                }
                edit_map(&mut p.anchors, action, "anchor")?
            }
            Resource::ScenePoint => {
                if let Action::Delete(id) = action {
                    let (id, cascade) = id
                        .split_once('?')
                        .map(|(a, b)| (a, b == "cascade"))
                        .unwrap_or((&id, false));
                    delete_scene_point(p, id, cascade)?;
                    Value::Null
                } else {
                    edit_map(&mut p.scene_points, action, "scene point")?
                }
            }
            Resource::Segments => match action {
                Action::Create(mut value) => {
                    value["id"] = json!(new_id());
                    let s: Segment = serde_json::from_value(value)?;
                    let result = json!(s);
                    p.segments.push(s);
                    result
                }
                Action::Delete(id) => {
                    let index = p
                        .segments
                        .iter()
                        .position(|s| s.id() == id)
                        .ok_or_else(|| Error::missing("segment", &id))?;
                    p.segments.remove(index);
                    Value::Null
                }
                Action::Clear => {
                    p.segments.clear();
                    p.motion_profile = Motion::default();
                    p.camera_track = CameraTrack::default();
                    Value::Null
                }
                _ => return Err(Error::invalid("Unsupported segment command")),
            },
            Resource::Motion => match action {
                Action::Update(id, changes) if id.is_empty() => {
                    p.motion_profile.default_speed = changes["default_speed"]
                        .as_f64()
                        .ok_or_else(|| Error::invalid("Missing default speed"))?;
                    json!(p.motion_profile)
                }
                Action::Clear => {
                    p.motion_profile = Motion::default();
                    json!(p.motion_profile)
                }
                a => edit_map(&mut p.motion_profile.keyframes, a, "speed keyframe")?,
            },
            Resource::Aim => match action {
                Action::Update(id, changes) if id.is_empty() => {
                    p.camera_track = patch(&p.camera_track, &changes)?;
                    view(p, Resource::Aim)
                }
                Action::Clear => {
                    p.camera_track.default_aim = Aim::default();
                    p.camera_track.world_up = [0., 1., 0.];
                    p.camera_track.keyframes.clear();
                    view(p, Resource::Aim)
                }
                a => edit_map(&mut p.camera_track.keyframes, a, "camera keyframe")?,
            },
            Resource::Orientation => match action {
                Action::Update(id, changes) if id.is_empty() => {
                    p.camera_track.default_orientation = serde_json::from_value(changes)?;
                    view(p, Resource::Orientation)
                }
                Action::Clear => {
                    p.camera_track.default_orientation = Orientation::default();
                    p.camera_track.orientation_keyframes.clear();
                    view(p, Resource::Orientation)
                }
                a => edit_map(
                    &mut p.camera_track.orientation_keyframes,
                    a,
                    "orientation keyframe",
                )?,
            },
            Resource::Dof => match action {
                Action::Create(value) if value.is_null() => {
                    if !p.camera_track.depth_of_field_keyframes.is_empty() {
                        return Ok((view(p, Resource::Dof), false));
                    }
                    let item: DofKeyframe = serde_json::from_value(json!({"path_position":0.0}))?;
                    p.camera_track
                        .depth_of_field_keyframes
                        .insert(item.id.clone(), item);
                    view(p, Resource::Dof)
                }
                a => edit_map(
                    &mut p.camera_track.depth_of_field_keyframes,
                    a,
                    "depth of field keyframe",
                )?,
            },
            Resource::Lidar => match action {
                Action::Clear => {
                    p.camera_track.lidar_keyframe = None;
                    Value::Null
                }
                Action::Update(_, changes) => {
                    let item = if let Some(old) = &p.camera_track.lidar_keyframe {
                        patch(old, &changes)?
                    } else {
                        serde_json::from_value(changes)?
                    };
                    p.camera_track.lidar_keyframe = Some(item);
                    view(p, Resource::Lidar)
                }
                _ => return Err(Error::invalid("Unsupported LiDAR command")),
            },
            Resource::Chat => {
                p.chat_history.clear();
                Value::Null
            }
        },
    };
    Ok((result, true))
}
