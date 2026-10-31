mod config;
mod http;
use camera_path_core::{
    agent::Agent,
    auth::Auth,
    database::Db,
    library::Library,
    ports::{Email, LanguageModel, Storage},
    service::Core,
};
use clap::{Parser, Subcommand};
use config::Config;
use std::{
    io::{self, IsTerminal},
    sync::Arc,
};
#[derive(Parser)]
#[command(
    name = "camera-path",
    version,
    about = "Camera Path modular Rust backend"
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}
#[derive(Subcommand)]
enum Command {
    Serve {
        #[arg(long, default_value = "127.0.0.1")]
        host: String,
        #[arg(long, default_value_t = 8000)]
        port: u16,
    },
    Migrate,
    EditorCreate {
        email: String,
    },
    OpenapiExport {
        #[arg(default_value = "openapi.json")]
        path: std::path::PathBuf,
    },
}
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "camera_path=info".into()),
        )
        .with_target(false)
        .init();
    let cli = Cli::parse();
    let config = Config::read()?;
    if let Some(Command::OpenapiExport { path }) = &cli.command {
        tokio::fs::write(path, include_str!("../../../../backend/openapi.json")).await?;
        return Ok(());
    }
    let db = Db::connect(&config.database_url).await?;
    db.migrate().await?;
    if matches!(cli.command, Some(Command::Migrate)) {
        return Ok(());
    }
    let sender: Arc<dyn Email> = match config.email_delivery.as_str() {
        "smtp" => Arc::new(camera_path_email_smtp::SmtpEmail::new(
            config.email_from.clone(),
            &config.smtp_host,
            config.smtp_port,
        )?),
        "ses" => {
            #[cfg(feature = "aws")]
            {
                Arc::new(
                    camera_path_email_ses::SesEmail::new(
                        config.email_from.clone(),
                        config.region.clone(),
                        config.profile.clone(),
                    )
                    .await?,
                )
            }
            #[cfg(not(feature = "aws"))]
            {
                anyhow::bail!("SES requires a binary built with --features aws")
            }
        }
        _ => unreachable!(),
    };
    let auth = Auth {
        db: db.clone(),
        secret: config.secret.clone(),
        ttl: config.ttl,
        email_factor: config.email_factor,
        sender,
    };
    if let Some(Command::EditorCreate { email }) = cli.command {
        let (password, confirmation) = if io::stdin().is_terminal() {
            (
                rpassword::prompt_password("Password: ")?,
                rpassword::prompt_password("Confirm password: ")?,
            )
        } else {
            let mut password = String::new();
            let mut confirmation = String::new();
            io::stdin().read_line(&mut password)?;
            io::stdin().read_line(&mut confirmation)?;
            (
                password.trim_end_matches(['\n', '\r']).to_string(),
                confirmation.trim_end_matches(['\n', '\r']).to_string(),
            )
        };
        anyhow::ensure!(password == confirmation, "Passwords do not match");
        auth.create_editor(&email, password).await?;
        return Ok(());
    }
    let storage: Arc<dyn Storage> = match config.storage.as_str() {
        "local" => Arc::new(
            camera_path_storage_local::LocalStorage::new(config.library_dir.clone()).await?,
        ),
        "s3" => {
            #[cfg(feature = "aws")]
            {
                Arc::new(
                    camera_path_storage_s3::S3Storage::new(
                        config.bucket.clone(),
                        config.prefix.clone(),
                        config.presign_ttl,
                        config.region.clone(),
                        config.profile.clone(),
                    )
                    .await?,
                )
            }
            #[cfg(not(feature = "aws"))]
            {
                anyhow::bail!("S3 requires a binary built with --features aws")
            }
        }
        _ => unreachable!(),
    };
    let core = Core {
        db: db.clone(),
        tolerance: config.tolerance,
    };
    let library = Library { db, storage };
    let provider: Option<Arc<dyn LanguageModel>> = config
        .api_key
        .as_ref()
        .map(|key| {
            camera_path_openai::OpenAi::new(key.clone(), &config.openai_url)
                .map(|p| Arc::new(p) as Arc<dyn LanguageModel>)
        })
        .transpose()?;
    let agent = Agent {
        core: core.clone(),
        model: config.model.clone(),
        provider,
    };
    let state = http::AppState::new(config.clone(), core.clone(), auth, library, agent)?;
    let (host, port) = match cli.command {
        Some(Command::Serve { host, port }) => (host, port),
        _ => ("127.0.0.1".into(), 8000),
    };
    let listener = tokio::net::TcpListener::bind(format!("{host}:{port}")).await?;
    let cancellation = tokio_util::sync::CancellationToken::new();
    let stop = cancellation.clone();
    tokio::spawn(async move {
        shutdown_signal().await;
        stop.cancel();
    });
    let ingress = camera_path_core::queue::Ingress {
        db: core.db.clone(),
    };
    let consumer = match config.queue.as_str() {
        "off" => None,
        "rabbitmq" => {
            #[cfg(feature = "dev")]
            {
                Some(tokio::spawn(camera_path_queue_rabbitmq::consume(
                    config.rabbit_url.clone(),
                    config.queue_name.clone(),
                    ingress,
                    cancellation.clone(),
                )))
            }
            #[cfg(not(feature = "dev"))]
            {
                anyhow::bail!("RabbitMQ requires --features dev")
            }
        }
        "sqs" => {
            #[cfg(feature = "aws")]
            {
                let consumer = camera_path_queue_sqs::SqsConsumer::new(
                    config.sqs_url.clone(),
                    config.sqs_dlq_url.clone(),
                    config.region.clone(),
                    config.profile.clone(),
                )
                .await?;
                Some(tokio::spawn(
                    consumer.consume(ingress, cancellation.clone()),
                ))
            }
            #[cfg(not(feature = "aws"))]
            {
                anyhow::bail!("SQS requires --features aws")
            }
        }
        _ => unreachable!(),
    };
    tracing::info!("Camera Path listening on {}", listener.local_addr()?);
    axum::serve(
        listener,
        state
            .router()?
            .into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .with_graceful_shutdown(cancellation.clone().cancelled_owned())
    .await?;
    cancellation.cancel();
    if let Some(consumer) = consumer {
        tokio::time::timeout(std::time::Duration::from_secs(30), consumer).await???;
    }
    Ok(())
}
async fn shutdown_signal() {
    #[cfg(unix)]
    {
        let mut term = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("signal handler");
        tokio::select! {_ = tokio::signal::ctrl_c()=>{},_ = term.recv()=>{}}
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}
