"""One-time schema snapshot generator; never reads user data. Not a runtime dependency."""

import json
from pathlib import Path

from camera_path.persistence.models import Base
from sqlalchemy import Boolean, DateTime, Float, Integer
from sqlalchemy.dialects.sqlite import dialect
from sqlalchemy.schema import CreateIndex, CreateTable

root = Path(__file__).resolve().parents[1] / "crates/core/src"
entities = root / "entities"
entities.mkdir(parents=True, exist_ok=True)
modules = []
schema = {}
ddl = []
for table in Base.metadata.sorted_tables:
    name = table.name
    modules.append(f"pub mod {name};")
    lines = [
        "//! Typed mapping of the existing Alembic schema.",
        "use sea_orm::entity::prelude::*;",
        "use serde::{Deserialize, Serialize};",
        "#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]",
        f'#[sea_orm(table_name = "{name}")]',
        "pub struct Model {",
    ]
    spec = []
    for col in table.columns:
        ty = (
            "bool"
            if isinstance(col.type, Boolean)
            else "i64"
            if isinstance(col.type, Integer)
            else "f64"
            if isinstance(col.type, Float)
            else "DateTime"
            if isinstance(col.type, DateTime)
            else "String"
        )
        if col.nullable:
            ty = f"Option<{ty}>"
        if col.primary_key:
            lines.append("    #[sea_orm(primary_key, auto_increment = false)]")
        lines.append(f"    pub {col.name}: {ty},")
        spec.append(
            {
                "name": col.name,
                "type": str(col.type.compile(dialect=dialect())),
                "nullable": col.nullable,
                "primary": col.primary_key,
            }
        )
    lines += [
        "}",
        "#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]",
        "pub enum Relation {}",
        "impl ActiveModelBehavior for ActiveModel {}",
    ]
    (entities / f"{name}.rs").write_text("\n".join(lines) + "\n")
    schema[name] = spec
    ddl.append(str(CreateTable(table).compile(dialect=dialect())).strip() + ";")
    ddl.extend(
        str(CreateIndex(index).compile(dialect=dialect())).strip() + ";"
        for index in table.indexes
    )
(entities / "mod.rs").write_text("\n".join(modules) + "\n")
(root / "legacy_schema.sql").write_text(
    "\n".join(line.rstrip() for line in "\n".join(ddl).splitlines()) + "\n"
)
(root / "legacy_schema.json").write_text(json.dumps(schema, indent=2) + "\n")
print("Exported", len(schema), "typed entities and schema (no records)")

fks = {
    table.name: sorted(
        [
            [
                element.column.table.name,
                element.parent.name,
                element.column.name,
                constraint.ondelete or "NO ACTION",
                constraint.onupdate or "NO ACTION",
            ]
            for constraint in table.foreign_key_constraints
            for element in constraint.elements
        ]
    )
    for table in Base.metadata.sorted_tables
}
(root / "legacy_foreign_keys.json").write_text(json.dumps(fks, indent=2) + "\n")
