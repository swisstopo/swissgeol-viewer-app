#!/bin/bash

MAX_RETRY_COUNT=10
SERVICE_NAME="$1"

if [ ! -n "$SERVICE_NAME" ]; then
  echo "Usage: wait_for_container.sh <service_name>"
  exit 1
fi

for i in $(seq 1 $MAX_RETRY_COUNT); do
  if [ "$(docker inspect -f '{{.State.Health.Status}}' "swissgeol-viewer-app-$SERVICE_NAME-1")" == "healthy" ]; then
    echo "Service $SERVICE_NAME is healthy!"
    exit 0
  else
    echo "Waiting for $SERVICE_NAME to be healthy... (attempt $i of $MAX_RETRY_COUNT)"
    sleep 10
  fi
done

echo "Service $SERVICE_NAME did not become healthy in time."
exit 1
