use sqlx::{
    postgres::{PgConnectOptions, PgPoolOptions},
    Connection, Executor, PgConnection, PgPool,
};

#[derive(clap::Parser)]
pub struct Database {
    /// The database username
    #[clap(env)]
    pub pguser: String,
    /// The database password
    #[clap(env, hide_env_values = true)]
    pub pgpassword: String,
    /// The database host name
    #[clap(env)]
    pub pghost: String,
    /// The database port
    #[clap(env)]
    pub pgport: u16,
    /// The database name
    #[clap(env)]
    pub pgdatabase: String,
}

impl Database {
    /// Create
    pub async fn setup(&self) -> PgPool {
        self.setup_with(&self.pgdatabase, false).await
    }

    pub async fn setup_with(&self, name: &str, create: bool) -> PgPool {
        // Connection options
        let options = PgConnectOptions::new_without_pgpass()
            .host(&self.pghost)
            .port(self.pgport)
            .username(&self.pguser)
            .password(&self.pgpassword);

        if create {
            // Create database
            let mut connection = PgConnection::connect_with(&options)
                .await
                .expect("Failed to connect to Postgres");
            connection
                .execute(format!(r#"CREATE DATABASE "{}";"#, name).as_str())
                .await
                .expect("Failed to create database.");
        }

        // Create pool
        let pool = PgPoolOptions::new()
            .max_connections(50)
            .connect_with(options.database(name))
            .await
            .expect("Failed to connect to Postgres.");

        // This embeds database migrations in the application binary so we can
        // ensure the database is migrated correctly on startup
        sqlx::migrate!()
            .run(&pool)
            .await
            .expect("Failed to migrate the database");

        pool
    }
}
