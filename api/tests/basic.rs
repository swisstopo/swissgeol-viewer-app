use axum::Router;
use clap::Parser;
use hyper::{Body, Request, StatusCode};
use tower::ServiceExt;
use uuid::Uuid; // for `app.oneshot()`

async fn spawn_app() -> Router {
    dotenv::dotenv().ok();

    let config = api::Config::parse();

    // Create & setup a new database
    let pool = config
        .database
        .setup_with(&Uuid::new_v4().to_string(), true)
        .await;

    api::app(pool).await
}

#[tokio::test]
async fn health_check_works() {
    // Arrange
    let app = spawn_app().await;

    // Act
    // `Router` implements `tower::Service<Request<Body>>` so we can
    // call it like any tower service, no need to run an HTTP server.
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/health_check")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Assert
    assert_eq!(response.status(), StatusCode::OK);
}
