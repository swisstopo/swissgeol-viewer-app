# local dev and dev/int/prod images are separate because they
# are built using a different and incompatible mode (default vs release)

FROM rust:1.73 AS builder


RUN apt update && apt install -y musl-tools musl-dev


RUN rustup target add x86_64-unknown-linux-musl

WORKDIR /app

COPY . .

#RUN cargo build --target x86_64-unknown-linux-musl --release --offline;
RUN cargo build --target x86_64-unknown-linux-musl --release --quiet

FROM alpine:3.17

RUN apk add --no-cache util-linux

## Import from builder.
#COPY --from=builder /etc/passwd /etc/passwd
#COPY --from=builder /etc/group /etc/group

WORKDIR /app

# Create appuser
#ENV USER=appuser
#ENV UID=10001

#RUN adduser \
#    --disabled-password \
#    --gecos "" \
#    --home "/nonexistent" \
#    --shell "/sbin/nologin" \
#    --no-create-home \
#    --uid "${UID}" \
#    "${USER}"

# Copy the app (we assume the musl libc from alpine is available and compatible)
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/api ./

#USER 10001
CMD ["/app/api"]
