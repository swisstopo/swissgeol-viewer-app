use anyhow::Context;
use aws_sdk_s3::Client;
use axum::extract::Path;
use axum::{
    extract::{Extension, Json},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use url::Url;
use uuid::Uuid;

use crate::auth::Claims;
use crate::Result;

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
    pub assets: Vec<String>,
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
    let status = if sqlx::query("SELECT 1 AS test")
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
    Json(mut project): Json<Project>,
) -> Result<Json<Uuid>> {
    project.id = Uuid::new_v4();
    let result = sqlx::query_scalar!(
        "INSERT INTO projects (id, project) VALUES ($1, $2) RETURNING id",
        project.id.to_owned(),
        sqlx::types::Json(project) as _
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(result))
}

#[axum_macros::debug_handler]
pub async fn duplicate_project(
    Extension(pool): Extension<PgPool>,
    Extension(client): Extension<Client>,
    Json(mut project): Json<Project>,
) -> Result<Json<Uuid>> {
    project.id = Uuid::new_v4();
    project.viewers = None;
    project.moderators = None;

    let mut assets: Vec<String> = Vec::new();

    for href in &project.assets {
        let url = Url::parse(href).context("Failed to parse asset url")?;
        let path = &url.path()[1..];
        let name_opt = path.split('/').last();
        if !path.is_empty() && name_opt.is_some() {
            let new_path = format!("assets/{}/{}", project.id, name_opt.unwrap());
            client
                .copy_object()
                .copy_source(format!("ngmpub-download-bgdi-ch/{path}"))
                .bucket("ngmpub-download-bgdi-ch")
                .key(&new_path)
                .send()
                .await
                .context("Failed to copy object")?;
            assets.push(format!("https://download.swissgeol.ch/{new_path}"));
        }
    }

    project.assets = assets;

    let result = sqlx::query_scalar!(
        "INSERT INTO projects (id, project) VALUES ($1, $2) RETURNING id",
        project.id,
        sqlx::types::Json(&project) as _
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(result))
}

#[axum_macros::debug_handler]
pub async fn get_projects_by_email(
    Extension(pool): Extension<PgPool>,
    Json(req): Json<GetRequest>,
) -> Result<Json<Vec<Project>>> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT project AS "project: sqlx::types::Json<Project>"
        FROM projects
        WHERE project->>'owner' = $1 OR
        project->'viewers' ? $1 OR
        project->'moderators' ? $1
        "#,
        req.email
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(
        result
            .iter()
            .map(|v: &sqlx::types::Json<Project>| v.to_owned().0)
            .collect(),
    ))
}

#[axum_macros::debug_handler]
pub async fn get_project(
    Extension(pool): Extension<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Project>> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT project as "project: sqlx::types::Json<Project>"
        FROM projects WHERE id = $1
        "#,
        id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(result.0))
}

#[axum_macros::debug_handler]
pub async fn token_test(claims: Claims) -> Result<Json<Claims>> {
    tracing::info!("{:#?}", claims);
    Ok(Json(claims))
}
