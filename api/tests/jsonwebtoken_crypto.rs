use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq)]
struct TestClaims {
    sub: String,
    exp: usize,
}

#[test]
fn jsonwebtoken_hs256_sign_and_verify() {
    let secret = b"test-secret-key-for-hmac";

    let claims = TestClaims {
        sub: "user@example.com".to_string(),
        // Far-future expiration (year ~2099) to keep the test deterministic.
        exp: 4_102_444_800,
    };

    let token = encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(secret),
    )
    .expect("encoding should succeed");

    let mut validation = Validation::new(Algorithm::HS256);
    validation.required_spec_claims.clear();

    let decoded = decode::<TestClaims>(
        &token,
        &DecodingKey::from_secret(secret),
        &validation,
    )
    .expect("decoding should succeed");

    assert_eq!(decoded.claims, claims);
}
