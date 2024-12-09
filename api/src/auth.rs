use anyhow::Context;
use axum::extract::FromRequestParts;
use axum::{async_trait, http::request::Parts};
use axum_extra::headers::authorization::Bearer;
use axum_extra::headers::Authorization;
use axum_extra::TypedHeader;
use jsonwebtoken::jwk::{AlgorithmParameters, JwkSet, KeyAlgorithm};
use jsonwebtoken::{Algorithm, DecodingKey, Validation};
use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};

use crate::Error;

/// JSON Web Key Set (JWKS)
static JWKS: OnceCell<JwkSet> = OnceCell::new();

/// Audience
static AUD: OnceCell<String> = OnceCell::new();

/// Issuer
static ISS: OnceCell<String> = OnceCell::new();

/// Configuration for AWS Cognito JWKS
#[derive(clap::Parser, Serialize)]
pub struct Auth {
    /// The cognito client id
    #[clap(long, env)]
    pub cognito_client_id: String,
    /// The user pool id
    #[clap(long, env)]
    pub cognito_pool_id: String,
    /// The identity pool id
    #[clap(long, env)]
    pub cognito_identity_pool_id: String,
    /// The AWS region
    #[clap(long, env, default_value = "eu-west-1")]
    pub cognito_aws_region: String,
}

impl Auth {
    pub async fn initialize(&self) -> anyhow::Result<()> {
        // Fetch & set JSON Web Key Set
        let url = format!(
            "https://cognito-idp.{}.amazonaws.com/{}/.well-known/jwks.json",
            self.cognito_aws_region, self.cognito_pool_id
        );
        let keyset = reqwest::get(url).await?.json().await?;
        JWKS.get_or_init(|| keyset);

        // Set auience
        let audience = self.cognito_client_id.clone();
        AUD.get_or_init(|| audience);

        // Set issuer
        let issuer = format!(
            "https://cognito-idp.{}.amazonaws.com/{}",
            self.cognito_aws_region, self.cognito_pool_id
        );
        ISS.get_or_init(|| issuer);

        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    aud: String,
    exp: usize,
    iss: String,
    pub email: String,
}

#[async_trait]
impl<S> FromRequestParts<S> for Claims
where
    S: Send + Sync,
{
    type Rejection = Error;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        // Extract the token from the authorization header
        let TypedHeader(Authorization(bearer)) =
            TypedHeader::<Authorization<Bearer>>::from_request_parts(parts, state)
                .await
                .map_err(|_| Error::Unauthorized)?;
        let token = bearer.token();

        // Decode the user data
        let header = jsonwebtoken::decode_header(token)
            .map_err(|_| Error::Jwt("Failed to decode token header"))?;
        let kid = header
            .kid
            .ok_or(Error::Jwt("Token is missing `kid` parameter"))?;
        let jwk = JWKS
            .get()
            .context("Once cell `JWKS` not initialized")?
            .find(&kid)
            .ok_or(Error::Jwt("No matching key found in keyset"))?;

        match jwk.algorithm {
            AlgorithmParameters::RSA(ref rsa) => {
                let decoding_key = DecodingKey::from_rsa_components(&rsa.n, &rsa.e)
                    .map_err(|_| Error::Jwt("Failed to create decoding key"))?;

                let algorithm = jwk
                    .common
                    .key_algorithm
                    .ok_or(Error::Jwt("JWK is missing `algorithm` parameter"))?;

                let mut validation = Validation::new(key_algorithm_to_algorithm(algorithm));
                validation.set_audience(&[AUD.get().context("Once cell `AUD` not initialized")?]);
                validation.set_issuer(&[ISS.get().context("Once cell `ISS` not initialized")?]);

                let decoded_token =
                    jsonwebtoken::decode::<Claims>(token, &decoding_key, &validation).map_err(
                        |_e| {
                            // TODO: Better error handling
                            // tracing::error!("{}", e);
                            Error::Jwt("Failed to decode token")
                        },
                    )?;
                Ok(decoded_token.claims)
            }
            _ => Err(Error::Jwt("Unreachable!")),
        }
    }
}

fn key_algorithm_to_algorithm(key_algorithm: KeyAlgorithm) -> Algorithm {
    match key_algorithm {
        KeyAlgorithm::RS256 => Algorithm::RS256,
        KeyAlgorithm::RS384 => Algorithm::RS384,
        KeyAlgorithm::RS512 => Algorithm::RS512,
        KeyAlgorithm::HS256 => Algorithm::HS256,
        KeyAlgorithm::HS384 => Algorithm::HS384,
        KeyAlgorithm::HS512 => Algorithm::HS512,
        KeyAlgorithm::ES256 => Algorithm::ES256,
        KeyAlgorithm::ES384 => Algorithm::ES384,
        _ => panic!("Unsupported algorithm {key_algorithm:?}"),
    }
}
