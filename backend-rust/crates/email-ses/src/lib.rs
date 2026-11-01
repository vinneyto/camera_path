use async_trait::async_trait;
use aws_sdk_sesv2::{
    Client,
    config::Region,
    types::{Body, Content, Destination, EmailContent, Message},
};
use camera_path_core::ports::Email;
pub struct SesEmail {
    from: String,
    client: Client,
}
impl SesEmail {
    pub async fn new(
        from: String,
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
        Ok(Self {
            from,
            client: Client::new(&loader.load().await),
        })
    }
}
#[async_trait]
impl Email for SesEmail {
    async fn send_code(&self, recipient: &str, code: &str) -> anyhow::Result<()> {
        let content=EmailContent::builder().simple(Message::builder().subject(Content::builder().data("Camera Path sign-in code").charset("UTF-8").build()?).body(Body::builder().text(Content::builder().data(format!("Your Camera Path sign-in code is {code}. It expires in 5 minutes.")).charset("UTF-8").build()?).build()).build()).build();
        self.client
            .send_email()
            .from_email_address(&self.from)
            .destination(Destination::builder().to_addresses(recipient).build())
            .content(content)
            .send()
            .await?;
        Ok(())
    }
}
