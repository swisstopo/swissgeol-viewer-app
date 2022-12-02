use aws_sdk_s3::Client;
use axum::extract::Path;
use axum::{
    extract::{Extension, Json},
    http::StatusCode,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::auth::Claims;
use crate::{Error, Result};

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct CreateProject {
    pub owner: String,
    pub viewers: Vec<String>,
    pub members: Vec<String>,
    pub title: String,
    pub description: Option<String>,
    pub image: Option<String>,
    pub color: String,
    #[serde(default)]
    pub views: Vec<View>,
    #[serde(default)]
    pub assets: Vec<Asset>,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct Project {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub created: DateTime<Utc>,
    pub modified: Option<DateTime<Utc>>,
    pub image: Option<String>,
    pub color: String,
    #[serde(default)]
    pub views: Vec<View>,
    #[serde(default)]
    pub assets: Vec<Asset>,
    pub owner: String,
    pub viewers: Vec<String>,
    pub members: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct View {
    pub id: String,
    pub title: String,
    pub permalink: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct Asset {
    pub href: String,
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
    Extension(pool): Extension<PgPool>,
    claims: Claims,
    Json(project): Json<CreateProject>,
) -> Result<Json<Uuid>> {
    // Sanity check
    if project.owner != claims.email {
        return Err(Error::Api(
            StatusCode::BAD_REQUEST,
            "Project owner does not match token claims.",
        ));
    }

    // Create project
    let project = Project {
        id: Uuid::new_v4(),
        title: project.title,
        description: project.description,
        created: Utc::now(),
        modified: None,
        image: project.image,
        color: project.color,
        views: project.views,
        assets: project.assets,
        owner: claims.email,
        viewers: project.viewers,
        members: project.members,
    };

    let result = sqlx::query_scalar!(
        "INSERT INTO projects (id, project) VALUES ($1, $2) RETURNING id",
        &project.id,
        sqlx::types::Json(&project) as _
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
        r#"SELECT project as "project: sqlx::types::Json<Project>" FROM projects WHERE id = $1"#,
        id
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(result.0))
}

#[axum_macros::debug_handler]
pub async fn update_project(
    Path(id): Path<Uuid>,
    Extension(pool): Extension<PgPool>,
    _claims: Claims,
    Json(mut project): Json<Project>,
) -> Result<StatusCode> {
    // TODO: Validate rights
    project.modified = Some(Utc::now());
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
    claims: Claims,
    Json(project): Json<CreateProject>,
) -> Result<Json<Uuid>> {
    // Sanity check
    if project.owner != claims.email {
        return Err(Error::Api(
            StatusCode::BAD_REQUEST,
            "Project owner does not match token claims.",
        ));
    }

    // Create project
    let duplicate = Project {
        id: Uuid::new_v4(),
        title: project.title,
        description: project.description,
        created: Utc::now(),
        modified: None,
        image: project.image,
        color: project.color,
        views: project.views,
        assets: Vec::new(),
        owner: claims.email,
        viewers: Vec::new(),
        members: Vec::new(),
    };

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

    // duplicate.assets = assets;

    let result = sqlx::query_scalar!(
        "INSERT INTO projects (id, project) VALUES ($1, $2) RETURNING id",
        &duplicate.id,
        sqlx::types::Json(&duplicate) as _
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(result))
}
