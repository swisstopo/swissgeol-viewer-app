use axum::{routing::get, routing::post, AddExtensionLayer, Router};
use sqlx::PgPool;
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use aws_sdk_s3::{Config, Credentials, Endpoint, Region, Client};

mod auth;
mod config;
mod database;
mod error;
mod handlers;

pub use error::Error;

pub type Result<T, E = Error> = std::result::Result<T, E>;

fn createAwsConfig() -> aws_sdk_s3::config::Config {
    // See https://github.com/awslabs/aws-sdk-rust/blob/1b923f86d5ca897da053661a30bddefb90e08ab4/sdk/s3/src/aws_endpoint.rs

    let access_key = std::env::var_os("AWS_ACCESS_KEY_ID").unwrap().into_string().unwrap();
    let secret_key = std::env::var_os("AWS_SECRET_ACCESS_KEY").unwrap().into_string().unwrap();

    // One has to define something to be the credential provider name,
    // but it doesn't seem like the value matters
    let provider_name = "my-creds";
    let creds = Credentials::new(&access_key, &secret_key, None, None, provider_name);

    // On amazon eu-west-1 it is "https://s3.eu-west-1.amazonaws.com"
    let endpoint_str = std::env::var_os("S3_ENDPOINT").unwrap().into_string().unwrap();
    let endpoint = Endpoint::immutable(endpoint_str.parse().unwrap());
    let region = std::env::var_os("AWS_DEFAULT_REGION").unwrap().into_string().unwrap();

    let config = Config::builder()
        .region(Region::new(region))
        .endpoint_resolver(endpoint)
        .credentials_provider(creds)
        .build();

    return config;
}

pub async fn app(pool: PgPool) -> Router {
    let aws_config = createAwsConfig();
    let aws_client =  Client::from_conf(aws_config);
    Router::new()
        .route("/api/health_check", get(handlers::health_check))
        .route(
            "/api/projects",
            get(handlers::get_projects_by_email).post(handlers::insert_project),
        )
        .route("/api/projects/duplicate", post(handlers::duplicate_project))
        .route("/api/projects/:id", get(handlers::get_project))
        .route("/api/token_test", get(handlers::token_test))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive())
                .layer(AddExtensionLayer::new(pool))
                .layer(AddExtensionLayer::new(aws_client)),
        )
}
