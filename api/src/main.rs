use std::net::SocketAddr;

use clap::StructOpt;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv::dotenv().ok();

    // Set the RUST_LOG, if it hasn't been explicitly defined
    if std::env::var_os("RUST_LOG").is_none() {
        std::env::set_var("RUST_LOG", "bedrock=debug,tower_http=debug")
    }
    tracing_subscriber::fmt::init();

    // Panic if we can't parse configuration
    let config = bedrock::config::Settings::parse();

    // Setup a database connection pool & run any pending migrations
    let pool = config.database.setup().await;

    // Build our application
    let app = bedrock::app(pool);

    // run our app with hyper
    // `axum::Server` is a re-export of `hyper::Server`
    let address = SocketAddr::from(([127, 0, 0, 1], config.application_port));
    tracing::debug!("listening on {}", address);

    axum::Server::bind(&address)
        .serve(app.into_make_service())
        .await
        .unwrap();

    Ok(())
}
