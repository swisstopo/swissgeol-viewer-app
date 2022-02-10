use hyper::{Body, Request, StatusCode};
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt; // for `app.oneshot()`

#[tokio::test]
async fn hello_world() {
    dotenv::dotenv().ok();

    let db_url = std::env::var("DATABASE_URL").expect("Read `DATABASE_URL` environmnet variable");

    // Database connection pool
    let pool = PgPoolOptions::new()
        .max_connections(50)
        .connect(&db_url)
        .await
        .expect("connect to database");

    let app = bedrock::run(pool);

    // `Router` implements `tower::Service<Request<Body>>` so we can
    // call it like any tower service, no need to run an HTTP server.
    let response = app
        .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    assert_eq!(&body[..], b"Hello, World!");
}
