## Builder
FROM rust:latest AS builder

RUN rustup target add x86_64-unknown-linux-musl
RUN cargo install cargo-watch
RUN apt update && apt install -y musl-tools musl-dev
RUN update-ca-certificates

# Create appuser
ENV USER=api
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

COPY Cargo.toml Cargo.lock ./
COPY ./src/stub.rs ./src/main.rs
RUN cargo fetch --target x86_64-unknown-linux-musl

COPY ./ .
RUN cargo build --target x86_64-unknown-linux-musl


# ## Final image
# FROM alpine

# # Import from builder.
# COPY --from=builder /etc/passwd /etc/passwd
# COPY --from=builder /etc/group /etc/group

# WORKDIR /app

# # Copy our build
# COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/api ./

# # Use an unprivileged user.
# USER api:api

CMD ["/app/api"]
