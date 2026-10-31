//! Typed mapping of the existing Alembic schema.
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "library_assets")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub name: String,
    pub format: String,
    pub object_key: String,
    pub size_bytes: i64,
    pub status: String,
    pub created_at: DateTime,
    pub default_rotation_x_deg: f64,
    pub default_rotation_y_deg: f64,
    pub default_rotation_z_deg: f64,
    pub default_scale: f64,
    pub default_offset_x: f64,
    pub default_offset_y: f64,
    pub default_offset_z: f64,
}
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
