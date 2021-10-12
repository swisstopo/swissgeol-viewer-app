#!/bin/bash -e

if [ -z "$VERSION" ]
then
  echo "Must provide VERSION"
  exit 1
fi

PROD_TAG="prod_viewer_`date '+r_%Y_%m_%d_%Hh%M'`"
git fetch
git checkout prod_viewer
git reset --hard origin/prod-viewer
git pull origin $VERSION
make dist
scripts/deploy_to_s3.sh prod-viewer
git tag $PROD_TAG -m $PROD_TAG
git push origin $PROD_TAG
git push origin prod-viewer
