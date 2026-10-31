use async_trait::async_trait;
use camera_path_core::ports::{LanguageModel, ModelEvent, ModelRequest};
use futures_util::StreamExt;
use serde_json::{Value, json};
use tokio::sync::mpsc;
pub struct OpenAi {
    client: reqwest::Client,
    key: String,
    url: String,
}
impl OpenAi {
    pub fn new(key: String, url: &str) -> anyhow::Result<Self> {
        Ok(Self {
            client: reqwest::Client::builder()
                .connect_timeout(std::time::Duration::from_secs(10))
                .timeout(std::time::Duration::from_secs(300))
                .build()?,
            key,
            url: format!("{}/responses", url.trim_end_matches('/')),
        })
    }
    async fn request(&self, r: ModelRequest, stream: bool) -> anyhow::Result<reqwest::Response> {
        let body = json!({"model":r.model,"instructions":r.instructions,"tools":r.tools,"input":r.input,"parallel_tool_calls":false,"stream":stream});
        for attempt in 0..3 {
            let response = self
                .client
                .post(&self.url)
                .bearer_auth(&self.key)
                .json(&body)
                .send()
                .await;
            match response {
                Ok(response) if response.status().is_success() => return Ok(response),
                Ok(response)
                    if (response.status().as_u16() == 429
                        || response.status().is_server_error())
                        && attempt < 2 => {}
                Ok(_) => anyhow::bail!("OpenAI request failed"),
                Err(_) if attempt < 2 => {}
                Err(_) => anyhow::bail!("OpenAI request failed"),
            }
            tokio::time::sleep(std::time::Duration::from_millis(500 * (attempt + 1))).await;
        }
        unreachable!()
    }
}
#[async_trait]
impl LanguageModel for OpenAi {
    async fn respond(&self, r: ModelRequest) -> anyhow::Result<Value> {
        Ok(self.request(r, false).await?.json().await?)
    }
    async fn stream(
        &self,
        r: ModelRequest,
        sender: mpsc::Sender<ModelEvent>,
    ) -> anyhow::Result<()> {
        let mut stream = self.request(r, true).await?.bytes_stream();
        let mut buffer = Vec::new();
        let mut completed = false;
        while let Some(chunk) = stream.next().await {
            buffer.extend_from_slice(&chunk?);
            anyhow::ensure!(
                buffer.len() <= 4 * 1024 * 1024,
                "Upstream SSE frame too large"
            );
            while let Some((end, separator)) = buffer
                .windows(2)
                .position(|w| w == b"\n\n")
                .map(|p| (p, 2))
                .or_else(|| {
                    buffer
                        .windows(4)
                        .position(|w| w == b"\r\n\r\n")
                        .map(|p| (p, 4))
                })
            {
                let frame = String::from_utf8(buffer.drain(..end + separator).collect())?;
                let data = frame
                    .lines()
                    .filter_map(|line| line.strip_prefix("data:").map(str::trim_start))
                    .collect::<Vec<_>>()
                    .join("\n");
                if data.is_empty() || data == "[DONE]" {
                    continue;
                }
                let value: Value = serde_json::from_str(&data)?;
                match value["type"].as_str() {
                    Some("response.output_text.delta") => {
                        sender
                            .send(ModelEvent::Delta(
                                value["delta"].as_str().unwrap_or("").into(),
                            ))
                            .await
                            .map_err(|_| anyhow::anyhow!("Client disconnected"))?;
                    }
                    Some("response.completed") => {
                        sender
                            .send(ModelEvent::Completed(value["response"].clone()))
                            .await
                            .map_err(|_| anyhow::anyhow!("Client disconnected"))?;
                        completed = true;
                    }
                    Some("response.failed" | "error") => anyhow::bail!("OpenAI stream failed"),
                    _ => {}
                }
            }
        }
        anyhow::ensure!(completed, "stream ended without a completed response");
        Ok(())
    }
}
