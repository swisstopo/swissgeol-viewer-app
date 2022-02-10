use axum::{
    routing::{get, post},
    AddExtensionLayer, Router,
};
use sqlx::PgPool;
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

mod handlers;

pub fn run(pool: PgPool) -> Router {
    Router::new()
        .route("/", get(handlers::root))
        .route("/projects", post(handlers::create_user))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive())
                .layer(AddExtensionLayer::new(pool)),
        )
}
