use axum::{extract::Extension, routing::get, routing::post, Router};
use clap::StructOpt;
use sqlx::PgPool;
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

mod auth;
mod config;
mod database;
mod error;
mod handlers;
mod s3;

pub use config::Config;
pub use error::Error;

pub type Result<T, E = Error> = std::result::Result<T, E>;

pub async fn app(pool: PgPool) -> Router {
    let aws_config = s3::S3::parse();
    let aws_client = aws_config.create_client().await;

    Router::new()
        .route("/api/health_check", get(handlers::health_check))
        .route(
            "/api/projects",
            get(handlers::list_projects).post(handlers::create_project),
        )
        .route("/api/projects/duplicate", post(handlers::duplicate_project))
        .route(
            "/api/projects/:id",
            get(handlers::get_project).put(handlers::update_project),
        )
        .route("/api/token_test", get(handlers::token_test))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive())
                .layer(Extension(pool))
                .layer(Extension(aws_client)),
        )
}
