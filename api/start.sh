#!/usr/bin/bash

SQLX_VERSION=0.8.2
if [[ ! -f ~/.cargo/bin/sqlx ]] || [[ $(sqlx --version) != "sqlx-cli $SQLX_VERSION" ]]; then
  cargo install sqlx-cli --version $SQLX_VERSION --no-default-features --features native-tls,postgres --locked
fi

sqlx database create
sqlx migrate run

cargo watch --poll --shell "cargo run"