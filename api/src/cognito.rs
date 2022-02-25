use anyhow::Context;
use axum::{
    async_trait,
    extract::{FromRequest, RequestParts, TypedHeader},
    headers::{authorization::Bearer, Authorization},
};
use clap::StructOpt;
use jsonwebtoken::jwk::{AlgorithmParameters, JwkSet};
use jsonwebtoken::{DecodingKey, Validation};
use once_cell::sync::Lazy;
use serde::Deserialize;
use tokio::runtime::Handle;

use crate::Error;

static JWKS: Lazy<JwkSet> = Lazy::new(|| {
    tokio::task::block_in_place(move || {
        Handle::current().block_on(async move {
            let config = CognitoConfig::parse();
            config.get_keys().await.expect("Get decoding key")
        })
    })
});

#[derive(clap::Parser)]
pub struct CognitoConfig {
    // The AWS region
    #[clap(long, env)]
    pub awsregion: String,
    // The cognito client id
    #[clap(long, env)]
    pub clientid: String,
    // The identity pool id
    #[clap(long, env)]
    pub poolid: String,
}

impl CognitoConfig {
    pub async fn get_keys(&self) -> Result<JwkSet, anyhow::Error> {
        let url = format!(
            "https://cognito-idp.{}.amazonaws.com/{}/.well-known/jwks.json",
            self.awsregion, self.poolid
        );

        let keyset: JwkSet = reqwest::get(url).await?.json().await?;

        Ok(keyset)
    }
}

#[derive(Debug, Deserialize)]
pub struct Claims {
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
        // Decode the user data
        let token = bearer.token();
        let header = jsonwebtoken::decode_header(token).context("Failed to decode token header")?;
        let kid = header.kid.ok_or(Error::Jwt("Token is missing `kid`"))?;
        let j = JWKS
            .find(&kid)
            .ok_or(Error::Jwt("No matching key found in keyset"))?;
        match j.algorithm {
            AlgorithmParameters::RSA(ref rsa) => {
                let decoding_key = DecodingKey::from_rsa_components(&rsa.n, &rsa.e)
                    .map_err(|_| Error::Jwt("Failed to create decoding key"))?;
                let algorithm = j
                    .common
                    .algorithm
                    .ok_or(Error::Jwt("JWK is missing algorithm parameter"))?;
                let validation = Validation::new(algorithm);
                let decoded_token =
                    jsonwebtoken::decode::<Claims>(token, &decoding_key, &validation)
                        .context("failed to decoe token")?;
                return Ok(decoded_token.claims);
            }
            _ => return Err(Error::Jwt("Unreachable!")),
        }
    }
}
