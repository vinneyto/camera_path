//! Typed mapping of the existing Alembic schema.
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "segment_anchors")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub segment_id: String,
    #[sea_orm(primary_key, auto_increment = false)]
    pub position: i64,
    pub anchor_id: String,
}
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
