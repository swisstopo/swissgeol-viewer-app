## Builder
FROM rust:latest AS builder

RUN rustup target add x86_64-unknown-linux-musl
RUN rustup component add clippy rustfmt
RUN apt-get update && apt-get install -y musl-tools musl-dev
#RUN update-ca-certificates

# Create appuser
ENV USER=appuser
ENV UID=10001

RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/nonexistent" \
    --shell "/sbin/nologin" \
    --no-create-home \
    --uid "${UID}" \
    "${USER}"


WORKDIR /app

# First we handle fetching and building our dependencies
# We need a stub entry point for that
COPY Cargo.toml Cargo.lock ./
COPY ./src/stub.rs ./src/main.rs
RUN cargo fetch --target x86_64-unknown-linux-musl
RUN cargo build --offline --target x86_64-unknown-linux-musl --release

COPY ./ .
ENV SQLX_OFFLINE=true
RUN cargo clippy --target x86_64-unknown-linux-musl --tests --examples --offline -- -D warnings
RUN cargo fmt --all -- --check
RUN cargo build --target x86_64-unknown-linux-musl --release --offline
RUN cargo doc --no-deps --offline

## Final image
FROM alpine

RUN apk add util-linux

# Import from builder.
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /etc/group /etc/group

WORKDIR /app

# Copy our build
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/api ./
COPY --from=builder /app/target/doc ./doc/

USER 10001
CMD ["/app/api"]
