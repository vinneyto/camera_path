use std::{env, path::PathBuf};
#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub library_dir: PathBuf,
    pub secret: String,
    pub ttl: i64,
    pub email_factor: bool,
    pub email_delivery: String,
    pub email_from: String,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub storage: String,
    pub bucket: String,
    pub prefix: String,
    pub presign_ttl: u64,
    #[cfg_attr(not(feature = "aws"), allow(dead_code))]
    pub region: Option<String>,
    #[cfg_attr(not(feature = "aws"), allow(dead_code))]
    pub profile: Option<String>,
    pub origins: Vec<String>,
    pub user_id: String,
    pub model: String,
    pub api_key: Option<String>,
    pub openai_url: String,
    pub tolerance: f64,
    pub queue: String,
    #[cfg_attr(not(feature = "dev"), allow(dead_code))]
    pub rabbit_url: String,
    #[cfg_attr(not(feature = "dev"), allow(dead_code))]
    pub queue_name: String,
    #[cfg_attr(not(feature = "aws"), allow(dead_code))]
    pub sqs_url: String,
    #[cfg_attr(not(feature = "aws"), allow(dead_code))]
    pub sqs_dlq_url: String,
}
fn get(name: &str, default: &str) -> String {
    env::var(format!("CAMERA_PATH_{name}")).unwrap_or_else(|_| default.into())
}
impl Config {
    pub fn read() -> anyhow::Result<Self> {
        let home = env::var("HOME").unwrap_or_else(|_| ".".into());
        let config = Self {
            database_url: get(
                "DATABASE_URL",
                &format!("sqlite:///{home}/.camera-path/camera_path.sqlite3"),
            ),
            library_dir: get("LIBRARY_DIRECTORY", &format!("{home}/.camera-path/library")).into(),
            secret: get("JWT_SECRET", ""),
            ttl: get("JWT_TTL_SECONDS", "28800").parse()?,
            email_factor: match get("AUTH_SECOND_FACTOR", "email").as_str() {
                "email" => true,
                "off" => false,
                _ => anyhow::bail!("Invalid second factor mode"),
            },
            email_delivery: get("AUTH_EMAIL_DELIVERY", "smtp"),
            email_from: get("AUTH_EMAIL_FROM", "noreply@camerapath.dev"),
            smtp_host: get("AUTH_SMTP_HOST", "127.0.0.1"),
            smtp_port: get("AUTH_SMTP_PORT", "1025").parse()?,
            storage: get("AWS_LIBRARY_STORAGE", "local"),
            bucket: get("AWS_S3_BUCKET", ""),
            prefix: get("AWS_S3_PREFIX", "library/"),
            presign_ttl: get("AWS_S3_URL_TTL_SECONDS", "300").parse()?,
            region: env::var("CAMERA_PATH_AWS_REGION")
                .or_else(|_| env::var("AWS_REGION"))
                .or_else(|_| env::var("AWS_DEFAULT_REGION"))
                .ok(),
            profile: env::var("CAMERA_PATH_AWS_PROFILE")
                .or_else(|_| env::var("AWS_PROFILE"))
                .ok(),
            origins: get(
                "CORS_ORIGINS",
                "http://localhost:3000,http://127.0.0.1:3000",
            )
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .collect(),
            user_id: get("DEV_USER_ID", "dev-user"),
            model: get("OPENAI_MODEL", "gpt-5.6-luna"),
            api_key: env::var("OPENAI_API_KEY").ok(),
            openai_url: env::var("OPENAI_BASE_URL")
                .unwrap_or_else(|_| "https://api.openai.com/v1".into()),
            tolerance: get("COMPILE_TOLERANCE", "0.001").parse()?,
            queue: get("QUEUE", "off"),
            rabbit_url: get("RABBITMQ_URL", "amqp://guest:guest@127.0.0.1:5672/%2f"),
            queue_name: get("QUEUE_NAME", "camera-path"),
            sqs_url: get("SQS_QUEUE_URL", ""),
            sqs_dlq_url: get("SQS_DLQ_URL", ""),
        };
        anyhow::ensure!(
            (60..=86400).contains(&config.ttl),
            "JWT TTL must be between 60 and 86400 seconds"
        );
        anyhow::ensure!(
            config.tolerance > 0.0 && config.tolerance.is_finite(),
            "Compilation tolerance must be positive"
        );
        anyhow::ensure!(
            ["local", "s3"].contains(&config.storage.as_str()),
            "Invalid storage mode"
        );
        anyhow::ensure!(
            ["smtp", "ses"].contains(&config.email_delivery.as_str()),
            "Invalid email delivery mode"
        );
        anyhow::ensure!(
            ["off", "rabbitmq", "sqs"].contains(&config.queue.as_str()),
            "Invalid queue mode"
        );
        anyhow::ensure!(
            config.storage != "s3" || !config.bucket.is_empty(),
            "S3 bucket is required"
        );
        anyhow::ensure!(
            config.prefix.ends_with('/')
                && config
                    .prefix
                    .trim_end_matches('/')
                    .split('/')
                    .all(|s| !s.is_empty() && s != "." && s != ".."),
            "Invalid S3 prefix"
        );
        anyhow::ensure!(
            (60..=3600).contains(&config.presign_ttl),
            "Invalid presigned URL TTL"
        );
        anyhow::ensure!(
            ["development", "production"].contains(&get("ENVIRONMENT", "development").as_str()),
            "Invalid environment"
        );
        anyhow::ensure!(
            get("ENVIRONMENT", "development") != "production"
                || (config.email_factor && config.email_delivery == "ses"),
            "Production requires email second factor with SES"
        );
        camera_path_core::auth::normalize_email(&config.email_from)?;
        Ok(config)
    }
}
