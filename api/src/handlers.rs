use aws_sdk_s3::Client;
use axum::{
    extract::{Extension, Json, Path, Multipart},
    http::StatusCode,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::auth::Claims;
use crate::{Error, Result};
use rand::{distributions::Alphanumeric, Rng};
use std::collections::HashSet;
use serde_json::Number;

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
    pub owner: String,
    pub viewers: Vec<String>,
    pub members: Vec<String>,
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
pub struct Asset {
    pub name: String,
    pub key: String,
}

#[allow(non_snake_case)]
#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
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
    editable: Option<bool>,
    copyable: Option<bool>,
    fromTopic: Option<bool>,
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

#[allow(non_snake_case)]
#[derive(Serialize, Deserialize, Clone, Debug, FromRow)]
struct GeometryVolumeHeightLimits {
    lowerLimit: Number,
    height: Number
}

#[derive(Serialize)]
pub struct UploadResponse {
    pub key: String,
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
    if project.owner != claims.email {
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
        owner: claims.email,
        viewers: project.viewers,
        members: project.members,
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

    Ok(Json(result.0))
}

#[axum_macros::debug_handler]
pub async fn update_project(
    Path(id): Path<Uuid>,
    Extension(pool): Extension<PgPool>,
    Extension(client): Extension<Client>,
    _claims: Claims,
    Json(mut project): Json<Project>,
) -> Result<StatusCode> {
    // TODO: Validate rights

    let bucket = std::env::var("S3_BUCKET").unwrap();

    let saved_project: Project = sqlx::query_scalar!(
        r#"SELECT project as "project: sqlx::types::Json<Project>" FROM projects WHERE id = $1"#,
        id
    )
        .fetch_one(&pool)
        .await?.0;

    let project_assets = &project.assets;
    let saved_project_keys: HashSet<_> = saved_project.assets.into_iter().map(|a| a.key).collect();
    let new_project_keys: HashSet<_> = project_assets.into_iter().map(|a| a.key.clone()).collect();

    // Find keys that are in saved_project_keys but not in new_project_keys
    let keys_to_delete: HashSet<_> = saved_project_keys.difference(&new_project_keys).collect();

    for key in keys_to_delete {
        let path = format!("assets/saved/{}.kml", key);

        client.delete_object()
            .bucket(&bucket)
            .key(&path)
            .send()
            .await.unwrap();
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
pub async fn update_project_geometries(
    Path(id): Path<Uuid>,
    Extension(pool): Extension<PgPool>,
    Extension(_client): Extension<Client>,
    _claims: Claims,
    Json(geometries): Json<Vec<Geometry>>,
) -> Result<StatusCode> {
    // TODO: Validate rights

    let mut project: Project = sqlx::query_scalar!(
        r#"SELECT project as "project: sqlx::types::Json<Project>" FROM projects WHERE id = $1"#,
        id
    )
        .fetch_one(&pool)
        .await?.0;

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
        geometries: project.geometries,
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

pub async fn upload_asset(
    Extension(_pool): Extension<PgPool>,
    Extension(client): Extension<Client>,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>> {
    let bucket = std::env::var("S3_BUCKET").unwrap();
    let rand_string: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(40)
        .map(char::from)
        .collect();
    let generated_file_name: String = format!("{}_{}", Utc::now().timestamp(), rand_string);
    let temp_key = format!("assets/temp/{}.kml", generated_file_name);
    while let Some(field) = multipart.next_field().await.unwrap() {
        if field.name() == Some("file") {
            let bytes = field.bytes().await.unwrap();

            client.put_object()
                .bucket(&bucket)
                .key(&temp_key)
                .body(bytes.into())
                .send()
                .await
                .unwrap();
        }
    }

    return Ok(Json(UploadResponse {key: generated_file_name}));
}

async fn save_assets(
    client: Client,
    project_assets: &Vec<Asset>
) {
    let bucket = std::env::var("S3_BUCKET").unwrap();
    for asset in project_assets {
        let temp_key = format!("assets/temp/{}.kml", asset.key);
        let permanent_key = format!("assets/saved/{}.kml", asset.key);

        // Check if the file exists in the source directory
        let source_exists = client.head_object()
            .bucket(&bucket)
            .key(&temp_key)
            .send()
            .await
            .is_ok();

        // Check if the file does not exist in the destination directory
        let destination_exists = client.head_object()
            .bucket(&bucket)
            .key(&permanent_key)
            .send()
            .await
            .is_ok();

        if source_exists && !destination_exists {
            client.copy_object()
                .bucket(&bucket)
                .copy_source(format!("{}/{}", &bucket, &temp_key))
                .key(&permanent_key)
                .send()
                .await.unwrap();

            client.delete_object()
                .bucket(&bucket)
                .key(&temp_key)
                .send()
                .await.unwrap();
        }

    }
}
