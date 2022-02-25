use aws_types::region::Region;
use axum::{routing::get, routing::post, AddExtensionLayer, Router};
use sqlx::PgPool;
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

mod auth;
mod config;
mod database;
mod error;
mod handlers;

pub use config::Config;
pub use error::Error;

pub type Result<T, E = Error> = std::result::Result<T, E>;

pub async fn app(pool: PgPool) -> Router {
    let aws_config = aws_config::from_env()
        .region(Region::new("eu-west-1"))
        .load()
        .await;

    let aws_client = aws_sdk_s3::Client::new(&aws_config);

    Router::new()
        .route("/api/health_check", get(handlers::health_check))
        .route(
            "/api/projects",
            get(handlers::get_projects_by_email).post(handlers::insert_project),
        )
        .route("/api/projects/duplicate", post(handlers::duplicate_project))
        .route("/api/projects/:id", get(handlers::get_project))
        .route("/api/token_test", get(handlers::token_test))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive())
                .layer(AddExtensionLayer::new(pool))
                .layer(AddExtensionLayer::new(aws_client)),
        )
}
