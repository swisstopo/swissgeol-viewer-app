use aws_sdk_s3::{Client, Config, Credentials, Endpoint, Region};
use hyper::Uri;

/// Configuration for AWS S3 Client
#[derive(clap::Parser)]
pub struct S3 {
    /// The S3 AWS access key id
    #[clap(env, hide_env_values = true)]
    pub aws_access_key_id: String,
    /// The S3 AWS secret access key
    #[clap(env, hide_env_values = true)]
    pub aws_secret_access_key: String,
    /// The S3 bucket name
    #[clap(env)]
    pub s3_bucket: String,
    /// The S3 AWS region
    #[clap(env, default_value = "eu-west-1")]
    pub s3_aws_region: String,
    /// Optional S3 endpoint
    #[clap(env)]
    pub s3_endpoint: Option<Uri>,
}

impl S3 {
    pub async fn create_client(&self) -> aws_sdk_s3::Client {
        if let Some(endpoint) = &self.s3_endpoint {
            let creds = Credentials::new(
                &self.aws_access_key_id,
                &self.aws_secret_access_key,
                None,
                None,
                "my-dev-credentials",
            );

            let endpoint = Endpoint::immutable(endpoint.to_owned());

            let config = Config::builder()
                .region(Region::new(self.s3_aws_region.to_owned()))
                .endpoint_resolver(endpoint)
                .credentials_provider(creds)
                .build();

            return Client::from_conf(config);
        }

        let aws_config = aws_config::from_env()
            .region(Region::new(self.s3_aws_region.to_owned()))
            .load()
            .await;
        aws_sdk_s3::Client::new(&aws_config)
    }
}
