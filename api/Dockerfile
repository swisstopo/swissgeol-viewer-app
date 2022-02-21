# local dev and dev/int/prod images are separate because they
# are built using a different and incompatible mode (default vs release)

FROM rust:latest AS builder
RUN apt-get update && apt-get install -y musl-tools musl-dev

RUN rustup target add x86_64-unknown-linux-musl
RUN rustup component add clippy rustfmt

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
# This rarely changes so is done once and for all
# Cargo needs a stub entry point otherwise it fails
COPY Cargo.toml Cargo.lock ./
COPY ./src/stub.rs ./src/main.rs
RUN cargo fetch --target x86_64-unknown-linux-musl
RUN cargo build --offline --target x86_64-unknown-linux-musl --release

# Then we copy every files, and detect linting / formating errors
# This is only detection, fixing the errors should be done outside docker
# We handle this section in offline mode to avoid unecessary and terribly long crates index update
COPY ./ .
ENV SQLX_OFFLINE=true
RUN cargo fmt --all -- --check
RUN cargo clippy --target x86_64-unknown-linux-musl --tests --examples --offline -- -D warnings --no-deps
RUN cargo test tests --target x86_64-unknown-linux-musl


# We build the app
RUN cargo build --target x86_64-unknown-linux-musl --release --offline


## The final image is quite small and almost minimal
FROM alpine:3.15

RUN apk add util-linux

# Import from builder.
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /etc/group /etc/group

WORKDIR /app

# Copy the app (we assume the musl libc from alpine is available and compatible)
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/api ./

USER 10001
CMD ["/app/api"]
