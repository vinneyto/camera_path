use async_trait::async_trait;
use camera_path_core::ports::{ObjectReader, ObjectUpload, Storage};
use std::path::{Path, PathBuf};
use tokio::{
    fs,
    io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt},
};
#[derive(Clone)]
pub struct LocalStorage {
    root: PathBuf,
}
impl LocalStorage {
    pub async fn new(root: PathBuf) -> anyhow::Result<Self> {
        fs::create_dir_all(&root).await?;
        Ok(Self {
            root: fs::canonicalize(root).await?,
        })
    }
    pub fn path(&self, key: &str) -> anyhow::Result<PathBuf> {
        anyhow::ensure!(
            !key.is_empty()
                && key != "."
                && key != ".."
                && Path::new(key).file_name().and_then(|s| s.to_str()) == Some(key)
                && !key.contains(['/', '\\']),
            "Invalid object key"
        );
        Ok(self.root.join(key))
    }
    fn staging(&self, id: &str) -> anyhow::Result<PathBuf> {
        anyhow::ensure!(uuid::Uuid::parse_str(id).is_ok(), "Invalid transaction ID");
        Ok(self.root.join(format!(".delete-{id}")))
    }
}
#[async_trait]
impl Storage for LocalStorage {
    async fn upload_url(&self, id: &str, _: &str, origin: &str) -> anyhow::Result<String> {
        Ok(format!("{origin}/api/v1/library/{id}/content"))
    }
    async fn download_url(&self, id: &str, _: &str, origin: &str) -> anyhow::Result<String> {
        Ok(format!("{origin}/api/v1/library/{id}/content"))
    }
    async fn put(&self, key: &str, data: &[u8]) -> anyhow::Result<()> {
        let path = self.path(key)?;
        let temp = path.with_extension(format!("{}.upload", uuid::Uuid::new_v4()));
        fs::write(&temp, data).await?;
        if let Err(error) = fs::rename(&temp, &path).await {
            let _ = fs::remove_file(temp).await;
            return Err(error.into());
        }
        Ok(())
    }
    async fn get(&self, key: &str) -> anyhow::Result<Vec<u8>> {
        Ok(fs::read(self.path(key)?).await?)
    }
    async fn finalize(&self, key: &str, expected: u64) -> anyhow::Result<bool> {
        let path = self.path(key)?;
        let Ok(mut file) = fs::File::open(&path).await else {
            return Ok(false);
        };
        if file.metadata().await?.len() != expected {
            return Ok(false);
        }
        let mut signature = [0u8; 4];
        if file.read_exact(&mut signature).await.is_err() {
            return Ok(false);
        }
        Ok(if key.ends_with(".sog") {
            signature == *b"PK\x03\x04"
        } else {
            signature == *b"ply\n" || signature == *b"ply\r"
        })
    }
    async fn stage_delete(&self, keys: &[String], id: &str) -> anyhow::Result<()> {
        let staging = self.staging(id)?;
        fs::create_dir(&staging).await?;
        for key in keys {
            let source = self.path(key)?;
            if let Err(error) = fs::rename(source, staging.join(key)).await
                && error.kind() != std::io::ErrorKind::NotFound
            {
                self.rollback_delete(keys, id).await?;
                return Err(error.into());
            }
        }
        Ok(())
    }
    async fn commit_delete(&self, _: &[String], id: &str) -> anyhow::Result<()> {
        let path = self.staging(id)?;
        if fs::try_exists(&path).await? {
            fs::remove_dir_all(path).await?;
        }
        Ok(())
    }
    async fn rollback_delete(&self, keys: &[String], id: &str) -> anyhow::Result<()> {
        let staging = self.staging(id)?;
        for key in keys.iter().rev() {
            if fs::try_exists(staging.join(key)).await? {
                fs::rename(staging.join(key), self.path(key)?).await?;
            }
        }
        if fs::try_exists(&staging).await? {
            fs::remove_dir(staging).await?;
        }
        Ok(())
    }
    async fn open_range(&self, key: &str, start: u64) -> anyhow::Result<ObjectReader> {
        let mut file = fs::File::open(self.path(key)?).await?;
        file.seek(std::io::SeekFrom::Start(start)).await?;
        Ok(Box::new(file))
    }
    async fn begin_upload(&self, key: &str) -> anyhow::Result<Box<dyn ObjectUpload>> {
        let path = self.path(key)?;
        let temporary = path.with_extension(format!("{}.upload", uuid::Uuid::new_v4()));
        let file = fs::File::create(&temporary).await?;
        Ok(Box::new(LocalUpload {
            file: Some(file),
            temporary,
            path,
            finished: false,
        }))
    }
    fn local_content(&self) -> bool {
        true
    }
}

struct LocalUpload {
    file: Option<fs::File>,
    temporary: PathBuf,
    path: PathBuf,
    finished: bool,
}
#[async_trait]
impl ObjectUpload for LocalUpload {
    async fn write(&mut self, data: &[u8]) -> anyhow::Result<()> {
        self.file.as_mut().unwrap().write_all(data).await?;
        Ok(())
    }
    async fn finish(mut self: Box<Self>) -> anyhow::Result<()> {
        if let Some(mut file) = self.file.take() {
            file.flush().await?;
            file.sync_all().await?;
        }
        fs::rename(&self.temporary, &self.path).await?;
        self.finished = true;
        Ok(())
    }
}
impl Drop for LocalUpload {
    fn drop(&mut self) {
        self.file.take();
        if !self.finished {
            let _ = std::fs::remove_file(&self.temporary);
        }
    }
}
