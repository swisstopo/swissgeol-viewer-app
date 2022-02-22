#![allow(unused)]

use std::collections::HashMap;
use std::future::Future;
use std::ops::Not;
use std::process::Output;
use std::str::FromStr;

use aws_sdk_s3::Client;
use axum::{
    async_trait,
    extract::{Extension, FromRequest, Json, RequestParts},
    http::StatusCode,
    response::IntoResponse,
};
use axum::extract::Path;
use serde::{Deserialize, Serialize};
use sqlx::{Error, FromRow, PgPool, Row};
use sqlx::postgres::PgRow;
use tower::ServiceExt;
use uuid::Uuid;

// Derive Serialize to return as Json
#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct Project {
    #[serde(default = "Uuid::new_v4")]
    pub id: Uuid,
    pub owner: String,
    pub viewers: Option<Vec<String>>,
    pub moderators: Option<Vec<String>>,
    pub title: String,
    pub description: String,
    pub created: String,
    pub modified: String,
    pub image: String,
    pub color: String,
    pub views: Vec<ProjectView>,
    pub assets: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct ProjectView {
    pub id: String,
    pub title: String,
    pub permalink: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GetRequest {
    pub email: String,
}

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

#[axum_macros::debug_handler]
pub async fn insert_project(
    Extension(pool): Extension<PgPool>,
    Json(project): Json<Project>,
) -> Result<axum::Json<Uuid>, StatusCode> {
    let id = Uuid::new_v4();
    let mut project = project;
    project.id = id;
    let result = sqlx::query_scalar("insert into projects (id, project) values ($1, $2) returning id")
        .bind(id)
        .bind(sqlx::types::Json(project))
        .fetch_one(&pool)
        .await
        .map_err(internal_error);

    match result {
        Ok(result) => Ok(axum::Json(result)), // wrap struct with Json & adapt function response signature as well
        Err((status, msg)) => Err(status),
    }
}

#[axum_macros::debug_handler]
pub async fn duplicate_project(
    Extension(pool): Extension<PgPool>,
    Extension(client): Extension<Client>,
    Json(project): Json<Project>,
) -> Result<axum::Json<Uuid>, StatusCode> {
    let id = Uuid::new_v4();
    let mut project = project;
    project.id = id;
    project.viewers = None;
    project.moderators = None;
    if project.assets.is_some() {
        for href in project.assets.as_ref().unwrap() {
            let bucket_name = format!("{}", "ngmpub-download-bgdi-ch");
            let mut split = href.as_str().split("https://download.swissgeol.ch/").collect::<Vec<&str>>().into_iter();
            let mut split2 = href.as_str().split('/').collect::<Vec<&str>>().into_iter();
            let path_opt = split.nth(1);
            let name_opt = split2.last();
            if path_opt.is_none().not() && name_opt.is_none().not() {
                let path: &str = path_opt.unwrap();
                let new_path: String = format!("assets/{}/{}", id.to_string().as_str(), name_opt.unwrap());
                match copy_aws_object(&client, &bucket_name, path, new_path.as_str()).await {
                    Ok(()) => Ok(()),
                    Err(e) => {
                        println!("{}", e);
                        Err(StatusCode::INTERNAL_SERVER_ERROR)
                    },
                };
            }
        }
    }

    let result = sqlx::query_scalar("insert into projects (id, project) values ($1, $2) returning id")
        .bind(id)
        .bind(sqlx::types::Json(project))
        .fetch_one(&pool)
        .await
        .map_err(internal_error);

    match result {
        Ok(result) => Ok(axum::Json(result)), // wrap struct with Json & adapt function response signature as well
        Err((status, msg)) => Err(status),
    }
}

#[axum_macros::debug_handler]
pub async fn get_projects_by_email(
    Extension(pool): Extension<PgPool>,
    Json(req): Json<GetRequest>,
) -> Result<axum::Json<Vec<Project>>, StatusCode> {
    match sqlx::query_scalar(
        r#"
          SELECT project as "project: sqlx::types::Json<Project>"
          FROM projects
          WHERE project->>'owner' = $1 OR
          project->'viewers' ? $1 OR
          project->'moderators' ? $1
    "#
    )
        .bind(req.email)
        .fetch_all(&pool)
        .await
    {
        Ok(result) => Ok(axum::Json(result.iter().map(|v: &sqlx::types::Json<Project>| v.to_owned().0).collect())),
        Err(e) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

#[axum_macros::debug_handler]
pub async fn get_project(
    Extension(pool): Extension<PgPool>,
    Path(params): Path<HashMap<String, String>>,
) -> Result<axum::Json<Project>, StatusCode> {
    let result: Result<sqlx::types::Json<Project>, (StatusCode, String)> = sqlx::query_scalar(
        r#"SELECT project as "project: sqlx::types::Json<Project>" FROM projects WHERE id = $1"#
    )
        .bind::<Uuid>(Uuid::parse_str(params.get("id").ok_or(StatusCode::INTERNAL_SERVER_ERROR).unwrap()).unwrap())
        .fetch_one(&pool)
        .await
        .map_err(internal_error);

    match result {
        Ok(result) => Ok(axum::Json(result.to_owned().0)),
        Err(e) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Utility function for mapping any error into a `500 Internal Server Error`
/// response.
fn internal_error<E>(err: E) -> (StatusCode, String)
    where
        E: std::error::Error,
{
    (StatusCode::INTERNAL_SERVER_ERROR, err.to_string())
}

pub async fn copy_aws_object(
    client: &Client,
    bucket_name: &str,
    object_key: &str,
    target_key: &str,
) -> Result<(), aws_sdk_s3::Error> {
    let mut source_bucket_and_object: String = "".to_owned();
    source_bucket_and_object.push_str(bucket_name);
    source_bucket_and_object.push('/');
    source_bucket_and_object.push_str(object_key);

    client
        .copy_object()
        .copy_source(source_bucket_and_object)
        .bucket(bucket_name)
        .key(target_key)
        .send()
        .await?;

    Ok(())
}
