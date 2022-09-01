use axum::http::{header::WWW_AUTHENTICATE, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    /// Return `401 Unauthorized`
    #[error("authentication required")]
    Unauthorized,

    /// Return `403 Forbidden`
    #[error("user may not perform that action")]
    Forbidden,

    /// Return `403 Forbidden`
    #[error("jsonwebtoken error")]
    Jwt(&'static str),

    /// Return `404 Not Found`
    #[error("request path not found")]
    NotFound,

    /// Automatically return `500 Internal Server Error` on a `sqlx::Error`.
    #[error("an error occurred with the database")]
    Sqlx(#[from] sqlx::Error),

    /// Return `500 Internal Server Error` on a `anyhow::Error`.
    #[error("an internal server error occurred")]
    Anyhow(#[from] anyhow::Error),

    /// Return a custom api error.
    #[error("an api error occurred")]
    Api(StatusCode, &'static str),
}

impl Error {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::Unauthorized => StatusCode::UNAUTHORIZED,
            Self::Forbidden | Self::Jwt(_) => StatusCode::FORBIDDEN,
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::Sqlx(_) | Self::Anyhow(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::Api(code, _) => *code,
        }
    }
}

impl IntoResponse for Error {
    fn into_response(self) -> Response {
        let message = match self {
            Self::Unauthorized => {
                return (
                    self.status_code(),
                    // Include the `WWW-Authenticate` challenge required in the specification
                    // for the `401 Unauthorized` response code:
                    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401
                    [(WWW_AUTHENTICATE, "Token")],
                    Json(json!({
                      "status": self.status_code().as_u16(),
                      "message": self.to_string(),
                    })),
                )
                    .into_response();
            }

            Self::Jwt(m) => {
                tracing::error!("Jsonwebtoken error: {:?}", m);
                m.to_owned()
            }

            Self::Sqlx(ref e) => {
                tracing::error!("SQLx error: {:?}", e);
                self.to_string()
            }

            Self::Anyhow(ref e) => {
                tracing::error!("Generic error: {:?}", e);
                self.to_string()
            }

            Self::Api(_, message) => {
                tracing::error!("Api error: {}", message);
                message.to_owned()
            }

            // Other errors get mapped normally.
            _ => self.to_string(),
        };

        let body = json!({
          "status": self.status_code().as_u16(),
          "message": message,
        });

        (self.status_code(), Json(body)).into_response()
    }
}
