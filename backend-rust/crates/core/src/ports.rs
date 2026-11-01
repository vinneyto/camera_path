use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::io::AsyncRead;
use tokio::sync::mpsc;
pub type ObjectReader = Box<dyn AsyncRead + Unpin + Send>;
#[async_trait]
pub trait ObjectUpload: Send {
    async fn write(&mut self, data: &[u8]) -> anyhow::Result<()>;
    async fn finish(self: Box<Self>) -> anyhow::Result<()>;
}

#[async_trait]
pub trait Email: Send + Sync {
    async fn send_code(&self, recipient: &str, code: &str) -> anyhow::Result<()>;
}

/// Storage owns physical paths, presigned URLs and delete staging. Core owns logical object keys.
#[async_trait]
pub trait Storage: Send + Sync {
    async fn upload_url(&self, asset_id: &str, key: &str, origin: &str) -> anyhow::Result<String>;
    async fn download_url(&self, asset_id: &str, key: &str, origin: &str)
    -> anyhow::Result<String>;
    async fn put(&self, key: &str, data: &[u8]) -> anyhow::Result<()>;
    async fn get(&self, key: &str) -> anyhow::Result<Vec<u8>>;
    async fn finalize(&self, key: &str, expected: u64) -> anyhow::Result<bool>;
    async fn stage_delete(&self, keys: &[String], transaction_id: &str) -> anyhow::Result<()>;
    async fn commit_delete(&self, keys: &[String], transaction_id: &str) -> anyhow::Result<()>;
    async fn rollback_delete(&self, keys: &[String], transaction_id: &str) -> anyhow::Result<()>;
    async fn open_range(&self, _key: &str, _start: u64) -> anyhow::Result<ObjectReader> {
        anyhow::bail!("Direct content is unavailable for this provider")
    }
    async fn begin_upload(&self, _key: &str) -> anyhow::Result<Box<dyn ObjectUpload>> {
        anyhow::bail!("Use the presigned upload URL for this provider")
    }
    fn local_content(&self) -> bool {
        false
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ModelRequest {
    pub model: String,
    pub instructions: String,
    pub tools: Value,
    pub input: Vec<Value>,
}
#[derive(Debug)]
pub enum ModelEvent {
    Delta(String),
    Completed(Value),
}
#[async_trait]
pub trait LanguageModel: Send + Sync {
    async fn respond(&self, request: ModelRequest) -> anyhow::Result<Value>;
    async fn stream(
        &self,
        request: ModelRequest,
        events: mpsc::Sender<ModelEvent>,
    ) -> anyhow::Result<()>;
}
