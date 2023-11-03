#!/bin/bash -e

os=$1 # mac for macos and empty for linux

cd api

IMAGE_NAME="camptocamp/swissgeol_api"

if [[ -z "${VERSION}" ]]
then
  echo Missing VERSION environment variable
  exit 1
fi


if [[ "$os" = "mac" ]]
then
  docker build --platform linux/amd64 --pull -t $IMAGE_NAME:$VERSION . --build-arg mac=true --no-cache
else
  docker build --pull -t $IMAGE_NAME:$VERSION .
fi
docker push $IMAGE_NAME:$VERSION
