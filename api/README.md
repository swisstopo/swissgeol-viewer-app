# bedrock



## Development

This section describes how to develop the swissgeol viewer api locally leveraging `cargo` and create database migrations. 



### Prerequisites

* [Docker](https://docs.docker.com/get-docker/)
* [psql](https://www.postgresql.org/download/)
* [Rust](https://www.rust-lang.org/tools/install)
* [sqlx-cli](https://github.com/launchbadge/sqlx/tree/master/sqlx-cli).

The latter can be installed with the following command

```bash
cargo install sqlx-cli --no-default-features --features rustls,postgres
```

### Setup

Initialize a database for development by spawning a docker container with

```bash
./scripts/init_db.sh
```

### Run

Start the application.

```bash
cargo run
```

### Test

Run all tests.

```bash
cargo test
```

### Migrations

To create a reversible migration run

```bash
sqlx migrate add -r <DESCRIPTION>
```

Check the documentation for further commands.

### sqlx offline

To use sqlx compile time verification without acces to a running database use it's `offline` mode.

Creating and updating the database/query definitions run

```bash
cargo sqlx prepare -- --lib
```

This creates/updates the [sqlx-data.json](./sqlx-data.json) file.
