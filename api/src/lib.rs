use axum::{
    Router,
    extract::{DefaultBodyLimit, Extension},
    http::{HeaderValue, Method},
    routing::get,
};
use clap::Parser;
use hyper::header::{
    ACCEPT, AUTHORIZATION, CONTENT_SECURITY_POLICY, CONTENT_TYPE, HeaderName, REFERRER_POLICY,
    STRICT_TRANSPORT_SECURITY, X_CONTENT_TYPE_OPTIONS, X_FRAME_OPTIONS,
};
use sqlx::PgPool;
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, set_header::SetResponseHeaderLayer, trace::TraceLayer};

pub use config::{ClientConfig, Config};
pub use error::Error;

mod auth;
mod config;
mod data;
mod database;
mod error;
mod handlers;
mod s3;
mod utils;

mod layers;
pub use layers::*;

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

    let permissions_policy_header_name = HeaderName::from_static("permissions-policy");
    let security_headers = ServiceBuilder::new()
        .layer(SetResponseHeaderLayer::if_not_present(
            STRICT_TRANSPORT_SECURITY,
            HeaderValue::from_static("max-age=31536000; includeSubDomains; preload"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            X_FRAME_OPTIONS,
            HeaderValue::from_static("SAMEORIGIN"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            CONTENT_SECURITY_POLICY,
            HeaderValue::from_static("default-src 'self'"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            REFERRER_POLICY,
            HeaderValue::from_static("no-referrer"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            permissions_policy_header_name,
            HeaderValue::from_static("geolocation=(), microphone=(), camera=()"),
        ));

    Router::new()
        .route("/api/client-config", get(handlers::get_client_config))
        .route("/api/layers", get(handlers::get_layer_config))
        .route("/api/health_check", get(handlers::health_check))
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
        .layer(security_headers)
}
