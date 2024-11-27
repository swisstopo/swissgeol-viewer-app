FROM rust:1.82 AS build

RUN apt update && apt install -y musl-tools musl-dev
RUN rustup target add x86_64-unknown-linux-musl

WORKDIR /app

COPY . .

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

COPY --from=build /app/target/x86_64-unknown-linux-musl/release/api ./

EXPOSE 3000

#USER 10001
CMD ["/app/api"]
