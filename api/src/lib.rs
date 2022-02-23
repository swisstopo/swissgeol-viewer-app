use aws_config::meta::region::RegionProviderChain;
use aws_sdk_s3::{Client, Region};
use axum::{routing::get, routing::post, AddExtensionLayer, Router};
use sqlx::PgPool;
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

pub mod config;
mod handlers;

pub async fn app(pool: PgPool) -> Router {
    let region_provider = RegionProviderChain::first_try(Region::new("eu-west-1"));
    let shared_config = aws_config::from_env().region(region_provider).load().await;
    let aws_client = Client::new(&shared_config);
    Router::new()
        .route("/api/health_check", get(handlers::health_check))
        .route(
            "/api/projects",
            get(handlers::get_projects_by_email).post(handlers::insert_project),
        )
        .route("/api/projects/duplicate", post(handlers::duplicate_project))
        .route("/api/projects/:id", get(handlers::get_project))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive())
                .layer(AddExtensionLayer::new(pool))
                .layer(AddExtensionLayer::new(aws_client)),
        )
}
