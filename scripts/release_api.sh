#!/bin/bash -e
cd api

IMAGE_NAME="camptocamp/swissgeol_api"

if [[ -z "${VERSION}" ]]
then
  echo Missing VERSION environment variable
  exit 1
fi


docker build --pull -t $IMAGE_NAME:$VERSION .
docker push $IMAGE_NAME:$VERSION
