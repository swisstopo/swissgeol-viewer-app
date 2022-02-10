use axum::{routing::get, Router};

#[tokio::main]
async fn main() {
    // build our application with a single route
    println!("Starting server...");
    let app = Router::new().route("/api/health_check", get(|| async { "Healthy" }));

    // run it with hyper on localhost:3000
    axum::Server::bind(&"0.0.0.0:3000".parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap();
    println!("Ending server...");
}
