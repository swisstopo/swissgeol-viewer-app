use aws_sdk_s3::Client;
use axum::{
    extract::{Extension, Json, Multipart, Path},
    http::StatusCode,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::auth::Claims;
use crate::{Error, Result};
use anyhow::Context;
use rand::{distributions::Alphanumeric, Rng};
use serde_json::Number;
use std::collections::HashSet;
use axum_macros::debug_handler;
use clap::Parser;

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct ProjectQuery {
    project: sqlx::types::Json<Project>,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct CreateProject {
    pub owner: Member,
    #[serde(default)]
    pub viewers: Vec<Member>,
    #[serde(default)]
    pub editors: Vec<Member>,
    pub title: String,
    pub description: Option<String>,
    pub image: Option<String>,
    pub color: String,
    #[serde(default)]
    pub views: Vec<View>,
    #[serde(default)]
    pub assets: Vec<Asset>,
    #[serde(default)]
    pub geometries: Vec<Geometry>,
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
    pub owner: Member,
    #[serde(default)]
    pub viewers: Vec<Member>,
    #[serde(default)]
    pub editors: Vec<Member>,
    #[serde(default)]
    pub geometries: Vec<Geometry>,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct View {
    pub id: String,
    pub title: String,
    pub permalink: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
#[allow(non_snake_case)]
pub struct Asset {
    pub name: String,
    pub key: String,
    pub clampToGround: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
pub struct Member {
    pub email: String,
    pub name: String,
    pub surname: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
#[allow(non_snake_case)]
pub struct Geometry {
    r#type: String,
    positions: Vec<Cartesian3>,
    id: Option<String>,
    name: Option<String>,
    show: Option<bool>,
    area: Option<String>,
    perimeter: Option<String>,
    sidesLength: Option<Vec<Number>>,
    numberOfSegments: Option<Number>,
    description: Option<String>,
    image: Option<String>,
    website: Option<String>,
    pointSymbol: Option<String>,
    color: Option<CesiumColor>,
    clampPoint: Option<bool>,
    showSlicingBox: Option<bool>,
    volumeShowed: Option<bool>,
    volumeHeightLimits: Option<GeometryVolumeHeightLimits>,
    swissforagesId: Option<String>,
    depth: Option<Number>,
    diameter: Option<Number>,
    editable: Option<bool>,
    copyable: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
struct Cartesian3 {
    x: Number,
    y: Number,
    z: Number,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
struct CesiumColor {
    red: Number,
    green: Number,
    blue: Number,
    alpha: Number,
}

#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
struct GeometryVolumeHeightLimits {
    #[allow(non_snake_case)]
    lowerLimit: Number,
    height: Number,
}

#[derive(Serialize)]
pub struct UploadResponse {
    pub key: String,
}

#[debug_handler]
pub async fn get_client_config() -> Json<crate::config::ClientConfig> {
    Json(crate::config::ClientConfig::parse())
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
    Extension(client): Extension<Client>,
    claims: Claims,
    Json(project): Json<CreateProject>,
) -> Result<Json<Uuid>> {
    // Sanity check
    if project.owner.email.to_lowercase() != claims.email.to_lowercase() {
        return Err(Error::Api(
            StatusCode::BAD_REQUEST,
            "Project owner does not match token claims.",
        ));
    }

    save_assets(client, &project.assets).await;

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
        owner: project.owner,
        viewers: project.viewers,
        editors: project.editors,
        geometries: project.geometries,
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

    let mut project = result;

    for viewer in project.viewers.iter_mut() {
        viewer.email = viewer.email.to_lowercase();
    }
    for editor in project.editors.iter_mut() {
        editor.email = editor.email.to_lowercase();
    }
    project.owner.email = project.owner.email.to_lowercase();

    Ok(Json(project.0))
}

#[axum_macros::debug_handler]
pub async fn update_project(
    Path(id): Path<Uuid>,
    Extension(pool): Extension<PgPool>,
    Extension(client): Extension<Client>,
    claims: Claims,
    Json(mut project): Json<Project>,
) -> Result<StatusCode> {
    let email = claims.email.to_lowercase();
    let member_emails: Vec<String> = project
        .editors
        .iter()
        .map(|p| p.email.clone().to_lowercase())
        .collect();
    if project.owner.email.to_lowercase() != email && !member_emails.contains(&email) {
        return Err(Error::Api(
            StatusCode::BAD_REQUEST,
            "Project owner does not match token claims.",
        ));
    }

    let bucket = std::env::var("PROJECTS_S3_BUCKET").unwrap();

    let saved_project: Project = sqlx::query_scalar!(
        r#"SELECT project as "project: sqlx::types::Json<Project>" FROM projects WHERE id = $1"#,
        id
    )
    .fetch_one(&pool)
    .await?
    .0;

    let project_assets = &project.assets;
    let saved_project_keys: HashSet<_> = saved_project.assets.into_iter().map(|a| a.key).collect();
    let new_project_keys: HashSet<_> = project_assets.iter().map(|a| a.key.clone()).collect();

    // Find keys that are in saved_project_keys but not in new_project_keys
    let keys_to_delete: HashSet<_> = saved_project_keys.difference(&new_project_keys).collect();

    for key in keys_to_delete {
        let path = format!("assets/saved/{}", key);

        client
            .delete_object()
            .bucket(&bucket)
            .key(&path)
            .send()
            .await
            .unwrap();
    }

    save_assets(client, project_assets).await;

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
pub async fn delete_project(
    Path(id): Path<Uuid>,
    Extension(pool): Extension<PgPool>,
    Extension(client): Extension<Client>,
    claims: Claims,
) -> Result<StatusCode> {
    // Delete assets from bucket
    let saved_project: Project = sqlx::query_scalar!(
        r#"SELECT project as "project: sqlx::types::Json<Project>" FROM projects WHERE id = $1"#,
        id
    )
    .fetch_one(&pool)
    .await?
    .0;

    if saved_project.owner.email.to_lowercase() != claims.email.to_lowercase() {
        return Err(Error::Api(
            StatusCode::BAD_REQUEST,
            "Project owner does not match token claims.",
        ));
    }

    if !saved_project.assets.is_empty() {
        delete_assets(client, &saved_project.assets).await
    }

    // Delete project from database
    sqlx::query(r#"DELETE FROM projects WHERE id = $1"#)
        .bind(id)
        .execute(&pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[axum_macros::debug_handler]
pub async fn update_project_geometries(
    Path(id): Path<Uuid>,
    Extension(pool): Extension<PgPool>,
    Extension(_client): Extension<Client>,
    claims: Claims,
    Json(geometries): Json<Vec<Geometry>>,
) -> Result<StatusCode> {
    let email = claims.email.to_lowercase();

    let mut project: Project = sqlx::query_scalar!(
        r#"SELECT project as "project: sqlx::types::Json<Project>" FROM projects WHERE id = $1"#,
        id
    )
    .fetch_one(&pool)
    .await?
    .0;

    let member_emails: Vec<String> = project
        .editors
        .iter()
        .map(|p| p.email.clone().to_lowercase())
        .collect();
    if project.owner.email.to_lowercase() != email && !member_emails.contains(&email) {
        return Err(Error::Api(
            StatusCode::BAD_REQUEST,
            "Project owner does not match token claims.",
        ));
    }

    project.geometries = geometries;

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
    let result = sqlx::query_as!(
        ProjectQuery,
        r#"
        SELECT project AS "project!: sqlx::types::Json<Project>"
        FROM projects
        WHERE
            LOWER(project->'owner'->>'email') = $1 OR
            EXISTS (
                SELECT 1 FROM jsonb_array_elements(project->'viewers') AS viewer
                WHERE LOWER(viewer->>'email') = $1
            ) OR
            EXISTS (
                SELECT 1 FROM jsonb_array_elements(project->'editors') AS editor
                WHERE LOWER(editor->>'email') = $1
            )
        "#,
        claims.email.to_lowercase()
    )
    .fetch_all(&pool)
    .await?;

    let mut project_queries = result;

    for project_query in project_queries.iter_mut() {
        for viewer in project_query.project.viewers.iter_mut() {
            viewer.email = viewer.email.to_lowercase();
        }
        for editor in project_query.project.editors.iter_mut() {
            editor.email = editor.email.to_lowercase();
        }
        project_query.project.owner.email = project_query.project.owner.email.to_lowercase();
    }

    Ok(Json(
        project_queries
            .iter()
            .map(|v: &ProjectQuery| v.project.to_owned().0)
            .collect(),
    ))
}

#[axum_macros::debug_handler]
pub async fn duplicate_project(
    Extension(pool): Extension<PgPool>,
    Extension(client): Extension<Client>,
    claims: Claims,
    Json(project): Json<CreateProject>,
) -> Result<Json<Uuid>> {
    // Sanity check
    if project.owner.email.to_lowercase() != claims.email.to_lowercase() {
        return Err(Error::Api(
            StatusCode::BAD_REQUEST,
            "Project owner does not match token claims.",
        ));
    }

    // Create project
    let mut duplicate = Project {
        id: Uuid::new_v4(),
        title: project.title,
        description: project.description,
        created: Utc::now(),
        modified: None,
        image: project.image,
        color: project.color,
        views: project.views,
        assets: Vec::new(),
        owner: project.owner,
        viewers: Vec::new(),
        editors: Vec::new(),
        geometries: project.geometries,
    };

    let mut assets: Vec<Asset> = Vec::new();
    let bucket = std::env::var("PROJECTS_S3_BUCKET").unwrap();

    for asset in &project.assets {
        let generated_file_name: String = generate_asset_name();
        let asset_key = format!("assets/saved/{}", asset.key);
        let dest_key = format!("assets/saved/{}", generated_file_name);
        // Check if the file exists in the source directory
        let source_exists = client
            .head_object()
            .bucket(&bucket)
            .key(&asset_key)
            .send()
            .await
            .is_ok();

        if source_exists {
            client
                .copy_object()
                .copy_source(format!("{}/{}", &bucket, &asset_key))
                .bucket(&bucket)
                .key(&dest_key)
                .send()
                .await
                .context("Failed to copy object")?;

            assets.push(Asset {
                name: asset.name.clone(),
                key: generated_file_name,
                clampToGround: asset.clampToGround,
            });
        }
    }

    duplicate.assets = assets;

    let result = sqlx::query_scalar!(
        "INSERT INTO projects (id, project) VALUES ($1, $2) RETURNING id",
        &duplicate.id,
        sqlx::types::Json(&duplicate) as _
    )
    .fetch_one(&pool)
    .await?;

    Ok(Json(result))
}

pub async fn upload_asset(
    Extension(_pool): Extension<PgPool>,
    Extension(client): Extension<Client>,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>> {
    let bucket = std::env::var("PROJECTS_S3_BUCKET").unwrap();
    let generated_file_name: String = generate_asset_name();
    let temp_name = format!("assets/temp/{}", generated_file_name);
    while let Some(field) = multipart.next_field().await.unwrap() {
        if field.name() == Some("file") {
            let bytes = field.bytes().await.unwrap();

            client
                .put_object()
                .bucket(&bucket)
                .key(&temp_name)
                .body(bytes.into())
                .send()
                .await
                .unwrap();
        }
    }

    Ok(Json(UploadResponse {
        key: generated_file_name,
    }))
}

async fn save_assets(client: Client, project_assets: &Vec<Asset>) {
    let bucket = std::env::var("PROJECTS_S3_BUCKET").unwrap();
    for asset in project_assets {
        let temp_key = format!("assets/temp/{}", asset.key);
        let permanent_key = format!("assets/saved/{}", asset.key);

        // Check if the file exists in the source directory
        let source_exists = client
            .head_object()
            .bucket(&bucket)
            .key(&temp_key)
            .send()
            .await
            .is_ok();

        // Check if the file does not exist in the destination directory
        let destination_exists = client
            .head_object()
            .bucket(&bucket)
            .key(&permanent_key)
            .send()
            .await
            .is_ok();

        if source_exists && !destination_exists {
            client
                .copy_object()
                .bucket(&bucket)
                .copy_source(format!("{}/{}", &bucket, &temp_key))
                .key(&permanent_key)
                .send()
                .await
                .unwrap();

            client
                .delete_object()
                .bucket(&bucket)
                .key(&temp_key)
                .send()
                .await
                .unwrap();
        }
    }
}

async fn delete_assets(client: Client, project_assets: &Vec<Asset>) {
    let bucket = std::env::var("PROJECTS_S3_BUCKET").unwrap();
    for asset in project_assets {
        let permanent_key = format!("assets/saved/{}", asset.key);

        // Check if the file exists in the destination directory
        let destination_exists = client
            .head_object()
            .bucket(&bucket)
            .key(&permanent_key)
            .send()
            .await
            .is_ok();

        if destination_exists {
            client
                .delete_object()
                .bucket(&bucket)
                .key(&permanent_key)
                .send()
                .await
                .unwrap();
        }
    }
}

fn generate_asset_name() -> String {
    let rand_string: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(40)
        .map(char::from)
        .collect();
    return format!("{}_{}.kml", Utc::now().timestamp(), rand_string);
}
