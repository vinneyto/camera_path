use aws_sdk_sqs::{Client, config::Region};
use camera_path_core::queue::{Envelope, Ingress, permanent};
use tokio_util::sync::CancellationToken;
pub struct SqsConsumer {
    client: Client,
    url: String,
    dead_letter_url: String,
}
impl SqsConsumer {
    pub async fn new(
        url: String,
        dead_letter_url: String,
        region: Option<String>,
        profile: Option<String>,
    ) -> anyhow::Result<Self> {
        anyhow::ensure!(
            !url.is_empty() && !dead_letter_url.is_empty(),
            "SQS queue and dead-letter URLs are required"
        );
        let mut loader = aws_config::defaults(aws_config::BehaviorVersion::latest());
        if let Some(region) = region {
            loader = loader.region(Region::new(region));
        }
        if let Some(profile) = profile {
            loader = loader.profile_name(profile);
        }
        Ok(Self {
            client: Client::new(&loader.load().await),
            url,
            dead_letter_url,
        })
    }
    pub async fn consume(self, ingress: Ingress, stop: CancellationToken) -> anyhow::Result<()> {
        while !stop.is_cancelled() {
            let result = tokio::select! {biased;_ = stop.cancelled()=>break,result=self.client.receive_message().queue_url(&self.url).wait_time_seconds(20).max_number_of_messages(1).visibility_timeout(60).send()=>result};
            let received = match result {
                Ok(messages) => messages,
                Err(error) => {
                    tracing::warn!(error=%error,"SQS receive failed; retrying");
                    tokio::select! {_ = stop.cancelled()=>break,_ = tokio::time::sleep(std::time::Duration::from_secs(2))=>{}}
                    continue;
                }
            };
            for message in received.messages() {
                let Some(receipt) = message.receipt_handle() else {
                    continue;
                };
                let body = message.body().unwrap_or("");
                let parsed = serde_json::from_str::<Envelope>(body);
                let (ack, reject) = match parsed {
                    Ok(message) => match ingress.process(message).await {
                        Ok(_) => (true, false),
                        Err(error) if permanent(&error) => (false, true),
                        Err(_) => (false, false),
                    },
                    Err(_) => (false, true),
                };
                // Rejected messages are durable in the DLQ before deleting the original. A retry can duplicate a DLQ entry, never lose it.
                let reject_stored = if reject {
                    self.client
                        .send_message()
                        .queue_url(&self.dead_letter_url)
                        .message_body(body)
                        .send()
                        .await
                        .is_ok()
                } else {
                    false
                };
                if (ack || reject_stored)
                    && let Err(error) = self
                        .client
                        .delete_message()
                        .queue_url(&self.url)
                        .receipt_handle(receipt)
                        .send()
                        .await
                {
                    tracing::warn!(error=%error,"SQS acknowledgement failed; redelivery is safe");
                }
            }
        }
        Ok(())
    }
}
