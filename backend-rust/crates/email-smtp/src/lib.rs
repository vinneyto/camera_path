use async_trait::async_trait;
use camera_path_core::ports::Email;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
pub struct SmtpEmail {
    from: String,
    transport: AsyncSmtpTransport<Tokio1Executor>,
}
impl SmtpEmail {
    pub fn new(from: String, host: &str, port: u16) -> anyhow::Result<Self> {
        anyhow::ensure!(
            ["127.0.0.1", "localhost", "::1"].contains(&host),
            "Development SMTP must use a loopback host"
        );
        let transport = AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(host)
            .port(port)
            .timeout(Some(std::time::Duration::from_secs(10)))
            .build();
        Ok(Self { from, transport })
    }
}
#[async_trait]
impl Email for SmtpEmail {
    async fn send_code(&self, recipient: &str, code: &str) -> anyhow::Result<()> {
        let message = Message::builder()
            .from(self.from.parse()?)
            .to(recipient.parse()?)
            .subject("Camera Path sign-in code")
            .body(format!(
                "Your Camera Path sign-in code is {code}. It expires in 5 minutes."
            ))?;
        self.transport.send(message).await?;
        Ok(())
    }
}
