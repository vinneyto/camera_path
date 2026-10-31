//! Typed mapping of the existing Alembic schema.
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "anchors")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub label: String,
    pub surface_position_x: f64,
    pub surface_position_y: f64,
    pub surface_position_z: f64,
    pub surface_normal_x: f64,
    pub surface_normal_y: f64,
    pub surface_normal_z: f64,
    pub lift: f64,
    pub lift_axis: String,
    pub project_id: String,
}
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
