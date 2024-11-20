use crate::{auth::Auth, database::Database};
use serde::Serialize;

#[derive(clap::Parser)]
pub struct Config {
    #[clap(flatten)]
    pub database: Database,
    #[clap(long, env)]
    pub app_port: u16,
    #[clap(flatten)]
    pub auth: Auth,
    #[clap(long, env)]
    pub env: String,
}

#[derive(clap::Parser, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientConfig {
    #[clap(long, env)]
    pub env: String,
    #[clap(long, env)]
    pub ion_default_access_token: String,
    #[clap(long, env)]
    pub gst_url: String,
    #[clap(flatten)]
    pub auth: Auth,
}
