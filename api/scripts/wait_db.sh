#!/usr/bin/env bash
set -x
set -eo pipefail

# Keep pinging Postgres until it's ready to accept commands
until psql -c '\q'; do
    >&2 echo "Postgres is still unavailable - sleeping"
    sleep 1
done
sleep 2s
