## Setup builder
FROM rust:latest AS builder

ARG CARGO_WATCH
ENV CARGO_WATCH=$CARGO_WATCH

RUN rustup target add x86_64-unknown-linux-musl
RUN apt-get update && apt-get install -y musl-tools musl-dev
RUN if [ "$CARGO_WATCH" = "true" ] ; then cargo install cargo-watch ; fi

WORKDIR /app

COPY ./ .

## Begin release
FROM builder

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

# Build release
ENV SQLX_OFFLINE=true

RUN cargo build --target x86_64-unknown-linux-musl --release --offline

## Final image
FROM alpine

RUN apk add util-linux

# Import from builder.
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /etc/group /etc/group

WORKDIR /app

# Copy our build
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/api ./

USER 10001
CMD ["/app/api"]
