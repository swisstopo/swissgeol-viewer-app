use anyhow::Context;
use axum::{
    async_trait,
    extract::{FromRequest, RequestParts, TypedHeader},
    headers::{authorization::Bearer, Authorization},
};
use jsonwebtoken::jwk::{AlgorithmParameters, JwkSet};
use jsonwebtoken::{DecodingKey, Validation};
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
#[derive(clap::Parser)]
pub struct Auth {
    /// The AWS region
    #[clap(long, env)]
    pub awsregion: String,
    /// The cognito client id
    #[clap(long, env)]
    pub clientid: String,
    /// The identity pool id
    #[clap(long, env)]
    pub poolid: String,
}

impl Auth {
    pub async fn initialize(&self) -> anyhow::Result<()> {
        let url = format!(
            "https://cognito-idp.{}.amazonaws.com/{}/.well-known/jwks.json",
            self.awsregion, self.poolid
        );
        let keyset = reqwest::get(url).await?.json().await?;

        JWKS.get_or_init(|| keyset);
        AUD.get_or_init(|| self.clientid.clone());
        ISS.get_or_init(|| {
            format!(
                "https://cognito-idp.{}.amazonaws.com/{}",
                self.awsregion, self.poolid
            )
        });

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
impl<B> FromRequest<B> for Claims
where
    B: Send,
{
    type Rejection = Error;

    async fn from_request(req: &mut RequestParts<B>) -> Result<Self, Self::Rejection> {
        // Extract the token from the authorization header
        let TypedHeader(Authorization(bearer)) =
            TypedHeader::<Authorization<Bearer>>::from_request(req)
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
                    .algorithm
                    .ok_or(Error::Jwt("JWK is missing `algorithm` parameter"))?;

                let mut validation = Validation::new(algorithm);
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

                return Ok(decoded_token.claims);
            }
            _ => return Err(Error::Jwt("Unreachable!")),
        }
    }
}
