//! Durable, provider-neutral queue ingress. Business change and deduplication marker share a transaction.
use crate::{
    Error, Result,
    database::{self, Db},
    geometry,
    models::Project,
};
use sea_orm::{ConnectionTrait, DbBackend, Statement};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Envelope {
    pub version: u32,
    pub idempotency_key: String,
    pub command: ExternalCommand,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum ExternalCommand {
    RenameProject { project_id: String, name: String },
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Applied,
    AlreadyApplied,
}
#[derive(Clone)]
pub struct Ingress {
    pub db: Db,
}
impl Ingress {
    pub async fn process(&self, message: Envelope) -> Result<Outcome> {
        if message.version != 1
            || message.idempotency_key.is_empty()
            || message.idempotency_key.len() > 128
        {
            return Err(Error::invalid(
                "Unsupported command version or invalid idempotency key",
            ));
        }
        let digest = format!("{:x}", Sha256::digest(serde_json::to_vec(&message)?));
        let tx = self.db.write().await?;
        if let Some(row) = tx
            .query_one_raw(Statement::from_sql_and_values(
                DbBackend::Sqlite,
                "SELECT payload_digest FROM processed_commands WHERE id=?",
                [message.idempotency_key.clone().into()],
            ))
            .await?
        {
            let previous: String = row.try_get("", "payload_digest")?;
            if previous != digest {
                return Err(Error::new(
                    409,
                    "idempotency_conflict",
                    "Idempotency key was reused for a different command",
                ));
            }
            tx.commit().await?;
            return Ok(Outcome::AlreadyApplied);
        }
        let ExternalCommand::RenameProject { project_id, name } = &message.command;
        let mut draft: Project = database::load(&tx, project_id).await?;
        let expected = draft.revision;
        draft.name = name.clone();
        geometry::validate(&draft)?;
        draft.revision += 1;
        database::save(&tx, &draft, expected).await?;
        tx.execute_raw(Statement::from_sql_and_values(
            DbBackend::Sqlite,
            "INSERT INTO processed_commands (id,payload_digest,processed_at) VALUES (?,?,?)",
            [
                message.idempotency_key.into(),
                digest.into(),
                crate::auth::now().into(),
            ],
        ))
        .await?;
        tx.commit().await?;
        Ok(Outcome::Applied)
    }
}
pub fn permanent(error: &Error) -> bool {
    (400..500).contains(&error.status)
}
