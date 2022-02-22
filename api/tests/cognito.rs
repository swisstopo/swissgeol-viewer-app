use clap::StructOpt;
use api::cognito::{CognitoConfig, CognitoClient};


#[tokio::test]
async fn cognito_client_works() {
    let client = CognitoClient::new(&CognitoConfig::parse());

    let email = client.email("invalid").await;
    assert!(email.is_none());
}
