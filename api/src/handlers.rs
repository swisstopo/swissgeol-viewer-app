use aws_sdk_s3::Client;
use axum::extract::Path;
use axum::{
    extract::{Extension, Json},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::auth::Claims;
use crate::Result;

// Derive Serialize to return as Json
#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct Project {
    #[serde(default = "Uuid::new_v4")]
    pub id: Uuid,
    pub owner: String,
    pub viewers: Vec<String>,
    pub members: Vec<String>,
    pub title: String,
    pub description: String,
    pub created: String,
    pub modified: String,
    pub image: String,
    pub color: String,
    pub views: Vec<ProjectView>,
    #[serde(default)]
    pub assets: Vec<Asset>,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct Asset {
    pub href: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct ProjectView {
    pub id: String,
    pub title: String,
    pub permalink: String,
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
pub async fn create_project(
    Json(mut project): Json<Project>,
    Extension(pool): Extension<PgPool>,
    claims: Claims,
) -> Result<Json<Uuid>> {
    project.id = Uuid::new_v4();
    project.owner = claims.email;
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
pub async fn get_project(
    Path(id): Path<Uuid>,
    Extension(pool): Extension<PgPool>,
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
pub async fn update_project(
    Path(id): Path<Uuid>,
    Json(project): Json<Project>,
    Extension(pool): Extension<PgPool>,
    _claims: Claims,
) -> Result<StatusCode> {
    // TODO: Validate rights
    sqlx::query_scalar!(
        "UPDATE projects SET project = project || CAST( $2 as JSONB) WHERE id = $1 RETURNING id",
        id,
        sqlx::types::Json(project) as _
    )
    .fetch_one(&pool)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[axum_macros::debug_handler]
pub async fn list_projects(
    Extension(pool): Extension<PgPool>,
    claims: Claims,
) -> Result<Json<Vec<Project>>> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT project AS "project: sqlx::types::Json<Project>"
        FROM projects
        WHERE project->>'owner' = $1 OR
        project->'viewers' ? $1 OR
        project->'members' ? $1
        "#,
        claims.email
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
pub async fn duplicate_project(
    Extension(pool): Extension<PgPool>,
    Extension(_client): Extension<Client>,
    Json(mut project): Json<Project>,
    claims: Claims,
) -> Result<Json<Uuid>> {
    project.id = Uuid::new_v4();
    project.owner = claims.email;
    project.viewers = Vec::new();
    project.members = Vec::new();

    let assets: Vec<Asset> = Vec::new();

    // // TODO: make static
    // let bucket = std::env::var("S3_BUCKET").unwrap();

    // for asset in &project.assets {
    //     let url = Url::parse(asset.href.as_str()).context("Failed to parse asset url")?;
    //     let path = &url.path()[1..];
    //     let name_opt = path.split('/').last();
    //     if !path.is_empty() && name_opt.is_some() {
    //         let new_path = format!("assets/{}/{}", project.id, name_opt.unwrap());
    //         client
    //             .copy_object()
    //             .copy_source(format!("{}/{}", &bucket, &path))
    //             .bucket(&bucket)
    //             .key(&new_path)
    //             .send()
    //             .await
    //             .context("Failed to copy object")?;
    //         assets.push(Asset {
    //             href: format!("https://download.swissgeol.ch/{new_path}"),
    //         });
    //     }
    // }

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
pub async fn token_test(claims: Claims) -> Result<Json<Claims>> {
    tracing::info!("{:#?}", claims);
    Ok(Json(claims))
}
