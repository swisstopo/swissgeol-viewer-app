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

COPY . .

ENV SQLX_OFFLINE true

RUN cargo clippy --tests --examples -- -D warnings
RUN cargo fmt --all -- --check
RUN cargo build --target x86_64-unknown-linux-musl --release
RUN cargo doc --no-deps

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
