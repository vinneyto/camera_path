//! Typed mapping of the existing Alembic schema.
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "camera_tracks")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub project_id: String,
    pub default_aim_kind: String,
    pub default_aim_direction: Option<String>,
    pub default_aim_scene_point_id: Option<String>,
    pub world_up_x: f64,
    pub world_up_y: f64,
    pub world_up_z: f64,
    pub default_orientation_yaw_deg: f64,
    pub default_orientation_pitch_deg: f64,
    pub default_orientation_roll_deg: f64,
}
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
