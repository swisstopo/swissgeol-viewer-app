use sqlx::{
    postgres::{PgConnectOptions, PgPoolOptions},
    Connection, Executor, PgConnection, PgPool,
};

#[derive(clap::Parser)]
pub struct Settings {
    #[clap(flatten)]
    pub database: Database,
    /// The application port
    #[clap(long, env = "APP_PORT")]
    pub application_port: u16,
}

#[derive(clap::Parser)]
pub struct Database {
    /// The database username
    #[clap(long = "db-user", env = "DB_USER")]
    pub user: String,
    /// The database password
    #[clap(long = "db-password", env = "DB_PASSWORD", hide_env_values = true)]
    pub password: String,
    /// The database host name
    #[clap(long = "db-host", env = "DB_HOST")]
    pub host: String,
    /// The database port
    #[clap(long = "db-port", env = "DB_PORT")]
    pub port: u16,
    /// The database name
    #[clap(long = "db-name", env = "DB_NAME")]
    pub name: String,
}

impl Database {
    /// Create
    pub async fn setup(&self) -> PgPool {
        self.setup_with(&self.name, false).await
    }

    pub async fn setup_with(&self, name: &str, create: bool) -> PgPool {
        // Connection options
        let options = PgConnectOptions::new_without_pgpass()
            .host(&self.host)
            .port(self.port)
            .username(&self.user)
            .password(&self.password);

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
