use axum::{routing::get, AddExtensionLayer, Router};
use sqlx::PgPool;
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

pub mod config;
mod handlers;

pub fn app(pool: PgPool) -> Router {
    Router::new()
        .route("/health_check", get(handlers::health_check))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive())
                .layer(AddExtensionLayer::new(pool)),
        )
}
