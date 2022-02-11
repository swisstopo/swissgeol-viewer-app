#!/bin/bash -e

if [ -n "$(git status --porcelain)" ];
then
  echo "KO: repository is not clean"
  git status --porcelain
  exit 4
fi

PROD_TAG="prod_viewer_`date '+r_%Y_%m_%d_%Hh%M'`"
cd ui
make dist
scripts/deploy_to_s3.sh prod-viewer
git tag $PROD_TAG -m $PROD_TAG
git push origin $PROD_TAG
git push -f origin $PROD_TAG:origin/prod-viewer
