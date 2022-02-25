use crate::{auth::Auth, database::Database};

#[derive(clap::Parser)]
pub struct Config {
    #[clap(flatten)]
    pub database: Database,
    /// The application port
    #[clap(long, env = "APP_PORT")]
    pub application_port: u16,
    #[clap(flatten)]
    pub auth: Auth,
}
