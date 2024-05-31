use axum::response::IntoResponse;
use axum::{
    extract::{DefaultBodyLimit, Extension},
    http::{HeaderValue, Method},
    routing::get,
    routing::post,
    routing::put,
    Router,
};
use clap::Parser;
use hyper::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use sqlx::PgPool;
use tower::{ServiceBuilder, ServiceExt};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

pub use config::Config;
pub use error::Error;

mod auth;
mod config;
mod database;
mod error;
mod handlers;
mod s3;

pub type Result<T, E = Error> = std::result::Result<T, E>;

const CORS_ORIGINS: &[&str] = &[
    "http://localhost:8000",
    "https://api.dev-viewer.swissgeol.ch",
    "https://api.int-viewer.swissgeol.ch",
    "https://api.swissgeol.ch",
    "https://review-viewer.swissgeol.ch",
    "https://dev-viewer.swissgeol.ch",
    "https://int-viewer.swissgeol.ch",
    "https://viewer.swissgeol.ch",
];

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
            get(handlers::get_project)
                .put(handlers::update_project)
                .delete(handlers::delete_project),
        )
        .route(
            "/api/projects/:id/geometries",
            put(handlers::update_project_geometries),
        )
        .route("/api/projects/upload_asset", post(handlers::upload_asset))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(
                    CorsLayer::new()
                        .allow_credentials(true)
                        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
                        .allow_origin(
                            CORS_ORIGINS
                                .iter()
                                .map(|s| s.parse().expect("parse origin"))
                                .collect::<Vec<HeaderValue>>(),
                        )
                        .allow_headers([AUTHORIZATION, ACCEPT, CONTENT_TYPE]),
                )
                .layer(Extension(pool))
                .layer(Extension(aws_client))
                .layer(DefaultBodyLimit::max(2 * 1024 * 1024)), // 2 MB limit (default value). PROJECT_ASSET_MAX_SIZE should be updated on frontend after this value update
        )
}
