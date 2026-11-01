//! Typed mapping of the existing Alembic schema.
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "aim_keyframes")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub path_position: f64,
    pub aim_kind: String,
    pub aim_direction: Option<String>,
    pub aim_scene_point_id: Option<String>,
    pub interpolation_to_next: String,
    #[sea_orm(primary_key, auto_increment = false)]
    pub project_id: String,
}
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
