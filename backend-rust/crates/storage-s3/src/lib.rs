use async_trait::async_trait;
use aws_sdk_s3::{Client, config::Region, presigning::PresigningConfig, primitives::ByteStream};
use camera_path_core::ports::Storage;
use std::time::Duration;
pub struct S3Storage {
    client: Client,
    bucket: String,
    prefix: String,
    ttl: u64,
}
impl S3Storage {
    pub async fn new(
        bucket: String,
        prefix: String,
        ttl: u64,
        region: Option<String>,
        profile: Option<String>,
    ) -> anyhow::Result<Self> {
        let mut loader = aws_config::defaults(aws_config::BehaviorVersion::latest());
        if let Some(region) = region {
            loader = loader.region(Region::new(region));
        }
        if let Some(profile) = profile {
            loader = loader.profile_name(profile);
        }
        let config = loader.load().await;
        let client = Client::from_conf(
            aws_sdk_s3::config::Builder::from(&config)
                .force_path_style(std::env::var("AWS_ENDPOINT_URL").is_ok())
                .build(),
        );
        Ok(Self {
            client,
            bucket,
            prefix,
            ttl,
        })
    }
    fn key(&self, key: &str, pending: bool) -> anyhow::Result<String> {
        anyhow::ensure!(
            !key.is_empty() && !key.contains(['/', '\\']) && key != "." && key != "..",
            "Invalid object key"
        );
        Ok(format!(
            "{}{}{key}",
            self.prefix,
            if pending { "_uploads/" } else { "" }
        ))
    }
    fn backup(&self, key: &str, id: &str, pending: bool) -> String {
        format!(
            "{}_delete/{id}/{}{key}",
            self.prefix,
            if pending { "_uploads/" } else { "" }
        )
    }
    async fn head(&self, key: &str) -> anyhow::Result<Option<(u64, String)>> {
        match self
            .client
            .head_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
        {
            Ok(head) => Ok(Some((
                head.content_length().unwrap_or(0) as u64,
                head.e_tag().unwrap_or("").into(),
            ))),
            Err(e) if e.as_service_error().is_some_and(|e| e.is_not_found()) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }
    async fn inspect(&self, key: &str) -> anyhow::Result<Option<(u64, Vec<u8>, String)>> {
        let Some((size, etag)) = self.head(key).await? else {
            return Ok(None);
        };
        if size == 0 {
            return Ok(Some((0, vec![], etag)));
        }
        let response = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .range("bytes=0-3")
            .if_match(&etag)
            .send()
            .await?;
        Ok(Some((
            size,
            response.body.collect().await?.into_bytes().to_vec(),
            etag,
        )))
    }
    async fn copy(
        &self,
        source: &str,
        destination: &str,
        etag: Option<&str>,
    ) -> anyhow::Result<()> {
        let source = percent_encoding::utf8_percent_encode(
            &format!("{}/{source}", self.bucket),
            percent_encoding::NON_ALPHANUMERIC,
        )
        .to_string();
        self.client
            .copy_object()
            .bucket(&self.bucket)
            .key(destination)
            .copy_source(source)
            .set_copy_source_if_match(etag.map(str::to_string))
            .send()
            .await?;
        Ok(())
    }
    async fn remove(&self, key: &str) -> anyhow::Result<()> {
        self.client
            .delete_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await?;
        Ok(())
    }
}
#[async_trait]
impl Storage for S3Storage {
    async fn upload_url(&self, _: &str, key: &str, _: &str) -> anyhow::Result<String> {
        Ok(self
            .client
            .put_object()
            .bucket(&self.bucket)
            .key(self.key(key, true)?)
            .presigned(PresigningConfig::expires_in(Duration::from_secs(self.ttl))?)
            .await?
            .uri()
            .into())
    }
    async fn download_url(&self, _: &str, key: &str, _: &str) -> anyhow::Result<String> {
        Ok(self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(self.key(key, false)?)
            .response_content_disposition(format!("attachment; filename=\"{key}\""))
            .presigned(PresigningConfig::expires_in(Duration::from_secs(self.ttl))?)
            .await?
            .uri()
            .into())
    }
    async fn put(&self, key: &str, data: &[u8]) -> anyhow::Result<()> {
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(self.key(key, true)?)
            .body(ByteStream::from(data.to_vec()))
            .send()
            .await?;
        Ok(())
    }
    async fn get(&self, key: &str) -> anyhow::Result<Vec<u8>> {
        Ok(self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(self.key(key, false)?)
            .send()
            .await?
            .body
            .collect()
            .await?
            .into_bytes()
            .to_vec())
    }
    async fn finalize(&self, key: &str, expected: u64) -> anyhow::Result<bool> {
        let pending = self.key(key, true)?;
        let ready = self.key(key, false)?;
        let valid = |size: u64, header: &[u8]| {
            size == expected
                && if key.ends_with(".ply") {
                    header == b"ply\n" || header == b"ply\r"
                } else {
                    key.ends_with(".sog") && header == b"PK\x03\x04"
                }
        };
        let Some((size, header, etag)) = self.inspect(&pending).await? else {
            return Ok(self
                .inspect(&ready)
                .await?
                .is_some_and(|(size, header, _)| valid(size, &header)));
        };
        if !valid(size, &header) {
            return Ok(false);
        }
        self.copy(&pending, &ready, Some(&etag)).await?;
        self.remove(&pending).await?;
        Ok(true)
    }
    async fn stage_delete(&self, keys: &[String], id: &str) -> anyhow::Result<()> {
        let staged = async {
            for key in keys {
                for pending in [false, true] {
                    let source = self.key(key, pending)?;
                    if let Some((_, etag)) = self.head(&source).await? {
                        self.copy(&source, &self.backup(key, id, pending), Some(&etag))
                            .await?;
                        self.remove(&source).await?;
                    }
                }
            }
            Ok::<_, anyhow::Error>(())
        }
        .await;
        if let Err(error) = staged {
            self.rollback_delete(keys, id).await?;
            return Err(error);
        }
        Ok(())
    }
    async fn commit_delete(&self, keys: &[String], id: &str) -> anyhow::Result<()> {
        for key in keys {
            for pending in [false, true] {
                self.remove(&self.backup(key, id, pending)).await?;
            }
        }
        Ok(())
    }
    async fn rollback_delete(&self, keys: &[String], id: &str) -> anyhow::Result<()> {
        for key in keys.iter().rev() {
            for pending in [true, false] {
                let backup = self.backup(key, id, pending);
                if self.head(&backup).await?.is_some() {
                    self.copy(&backup, &self.key(key, pending)?, None).await?;
                }
            }
        }
        self.commit_delete(keys, id).await
    }
}
