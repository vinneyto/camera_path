use camera_path_core::queue::{Envelope, Ingress, permanent};
use futures_util::StreamExt;
use lapin::{
    Connection, ConnectionProperties, ExchangeKind,
    options::*,
    types::{AMQPValue, FieldTable, LongString, ShortString},
};
use tokio_util::sync::CancellationToken;
pub async fn consume(
    url: String,
    queue: String,
    ingress: Ingress,
    stop: CancellationToken,
) -> anyhow::Result<()> {
    while !stop.is_cancelled() {
        let result = connected(&url, &queue, &ingress, &stop).await;
        if let Err(error) = result {
            tracing::warn!(error=%error,"RabbitMQ consumer disconnected; retrying");
        }
        tokio::select! {_ = stop.cancelled()=>break,_ = tokio::time::sleep(std::time::Duration::from_secs(2))=>{}}
    }
    Ok(())
}
async fn connected(
    url: &str,
    queue: &str,
    ingress: &Ingress,
    stop: &CancellationToken,
) -> anyhow::Result<()> {
    let connection = Connection::connect(url, ConnectionProperties::default()).await?;
    let channel = connection.create_channel().await?;
    let exchange = format!("{queue}.dead");
    let dead = format!("{queue}.dead");
    channel
        .exchange_declare(
            &exchange,
            ExchangeKind::Direct,
            ExchangeDeclareOptions {
                durable: true,
                ..Default::default()
            },
            FieldTable::default(),
        )
        .await?;
    channel
        .queue_declare(
            &dead,
            QueueDeclareOptions {
                durable: true,
                ..Default::default()
            },
            FieldTable::default(),
        )
        .await?;
    channel
        .queue_bind(
            &dead,
            &exchange,
            queue,
            QueueBindOptions::default(),
            FieldTable::default(),
        )
        .await?;
    let mut args = FieldTable::default();
    args.insert(
        ShortString::from("x-queue-type"),
        AMQPValue::LongString(LongString::from("quorum")),
    );
    args.insert(ShortString::from("x-delivery-limit"), AMQPValue::LongInt(5));
    args.insert(
        ShortString::from("x-dead-letter-exchange"),
        AMQPValue::LongString(LongString::from(exchange)),
    );
    args.insert(
        ShortString::from("x-dead-letter-routing-key"),
        AMQPValue::LongString(LongString::from(queue)),
    );
    channel
        .queue_declare(
            queue,
            QueueDeclareOptions {
                durable: true,
                ..Default::default()
            },
            args,
        )
        .await?;
    channel.basic_qos(1, BasicQosOptions::default()).await?;
    let mut consumer = channel
        .basic_consume(
            queue,
            "camera-path",
            BasicConsumeOptions::default(),
            FieldTable::default(),
        )
        .await?;
    loop {
        let delivery =
            tokio::select! {biased;_ = stop.cancelled()=>break,item=consumer.next()=>item};
        let Some(delivery) = delivery else {
            anyhow::bail!("RabbitMQ consumer ended")
        };
        let delivery = delivery?;
        match serde_json::from_slice::<Envelope>(&delivery.data) {
            Ok(message) => match ingress.process(message).await {
                Ok(_) => {
                    delivery.ack(BasicAckOptions::default()).await?;
                }
                Err(error) if permanent(&error) => {
                    delivery
                        .reject(BasicRejectOptions { requeue: false })
                        .await?;
                }
                Err(_) => {
                    delivery
                        .nack(BasicNackOptions {
                            multiple: false,
                            requeue: true,
                        })
                        .await?;
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                }
            },
            Err(_) => {
                delivery
                    .reject(BasicRejectOptions { requeue: false })
                    .await?;
            }
        }
    }
    channel
        .basic_cancel("camera-path", BasicCancelOptions::default())
        .await?;
    connection.close(200, "Shutdown").await?;
    Ok(())
}
