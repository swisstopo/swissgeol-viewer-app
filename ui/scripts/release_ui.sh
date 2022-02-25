#!/bin/bash -e

RELEASES_BUCKET="ngmpub-review-bgdi-ch"

if [[ -z "${VERSION}" ]]
then
  echo Missing VERSION environment variable
  exit 1
fi


function build {
  npm ci
  npm run lint
  npm run test
  npm run build
  npm run build-storybook
  npm run test:e2e

  #rm -f dist.tar.bz2 || true
  # tar cjvf dist.tar.bz2 dist/
}


function upload {
  export AWS_REGION=eu-west-1
  export AWS_ACCESS_KEY_ID=$(gopass cat ngm/s3/deploybucket/AWS_ACCESS_KEY_ID)
  export AWS_SECRET_ACCESS_KEY=$(gopass cat ngm/s3/deploybucket/AWS_SECRET_ACCESS_KEY)
  aws s3 sync --delete dist s3://$RELEASES_BUCKET/releases/$VERSION
}


export RELEASE_NAME="$VERSION"
build
upload
