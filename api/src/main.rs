use clap::Parser;
use std::net::SocketAddr;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load the variable from `.env` into the environment.
    dotenv::dotenv().ok();

    // Set the RUST_LOG, if it hasn't been explicitly defined
    if std::env::var_os("RUST_LOG").is_none() {
        std::env::set_var("RUST_LOG", "api=debug,tower_http=debug")
    }
    tracing_subscriber::fmt::init();

    // Panic if we can't parse configuration
    let config = api::Config::parse();

    // Setup a database connection pool & run any pending migrations
    let pool = config.database.setup().await;

    // Initialize JSON Web Key Set (JWKS)
    config.auth.initialize().await?;

    // Build our application
    let app = api::app(pool).await;

    // run our app with hyper
    // `axum::Server` is a re-export of `hyper::Server`
    let address = SocketAddr::from(([0, 0, 0, 0], config.app_port));
    tracing::debug!("listening on {}", address);

    axum::Server::bind(&address)
        .serve(app.into_make_service())
        .await
        .unwrap();

    Ok(())
}
