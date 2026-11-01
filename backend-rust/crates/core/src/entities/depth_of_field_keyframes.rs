//! Typed mapping of the existing Alembic schema.
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "depth_of_field_keyframes")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub path_position: f64,
    pub focus_kind: String,
    pub focus_scene_point_id: Option<String>,
    pub focus_range_scale: f64,
    pub bokeh_scale: f64,
    #[sea_orm(primary_key, auto_increment = false)]
    pub project_id: String,
}
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
