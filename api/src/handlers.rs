use axum::{extract::Extension, http::StatusCode};
use sqlx::PgPool;

// Health check endpoint
pub async fn health_check(Extension(pool): Extension<PgPool>) -> (StatusCode, String) {
    let version = format!("CARGO_PKG_VERSION: {}", env!("CARGO_PKG_VERSION"));
    let status = if sqlx::query!("SELECT 1 AS test")
        .fetch_one(&pool)
        .await
        .is_ok()
    {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    (status, version)
}
