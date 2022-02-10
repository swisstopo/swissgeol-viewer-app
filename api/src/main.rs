use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    // Set the RUST_LOG, if it hasn't been explicitly defined
    if std::env::var_os("RUST_LOG").is_none() {
        std::env::set_var("RUST_LOG", "bedrock=debug,tower_http=debug")
    }
    // initialize tracing
    tracing_subscriber::fmt::init();

    // let db_connection_str = std::env::var("DATABASE_URL")
    //     .unwrap_or_else(|_| "postgres://postgres:password@localhost".to_string());

    // // setup connection pool
    // let pool = PgPoolOptions::new()
    //     .max_connections(5)
    //     .connect_timeout(Duration::from_secs(3))
    //     .connect(&db_connection_str)
    //     .await
    //     .expect("can connect to database");

    // build our application with a route
    let app = bedrock::run();

    // run our app with hyper
    // `axum::Server` is a re-export of `hyper::Server`
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    tracing::debug!("listening on {}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
    println!("Ending server...");
}
