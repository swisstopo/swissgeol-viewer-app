use jsonwebtokens::Verifier;
use jsonwebtokens_cognito::KeySet;

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

// #[derive(Clone)]
pub struct CognitoClient {
    pub keyset: KeySet,
    pub verifier: Verifier,
}

impl CognitoClient {
    pub fn new(config: &CognitoConfig) -> CognitoClient {
        let keyset =
            KeySet::new(&config.awsregion, &config.poolid).expect("Failed to create keyset");
        let verifier = keyset
            .new_id_token_verifier(&[&config.clientid])
            .build()
            .expect("Failed to create verifier");
        CognitoClient { keyset, verifier }
    }

    pub async fn email(&self, token: &str) -> Option<String> {
        self.keyset
            .verify(&token, &self.verifier)
            .await
            .ok()
            .and_then(|value| {
                value
                    .get("email")
                    .and_then(|email| email.as_str().map(|s| s.to_owned()))
            })
    }
}
