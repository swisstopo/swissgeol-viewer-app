use axum::{
    routing::{get, post},
    Router,
};
use tower_http::trace::TraceLayer;

mod handlers;

pub fn run() -> Router {
    Router::new()
        // `GET /` goes to `root`
        .route("/", get(handlers::root))
        // `POST /users` goes to `create_user`
        .route("/users", post(handlers::create_user))
        .layer(TraceLayer::new_for_http())
    // .layer(AddExtensionLayer::new(pool))
}
