#!/bin/bash -e

if [ -z "$VERSION" ]
then
  echo "Must provide VERSION"
  exit 1
fi

PROD_TAG="prod_`date '+r_%Y_%m_%d_%Hh%M'`"
git fetch
git checkout prod
git reset --hard origin/prod
git pull origin $VERSION
make dist
cat > dist/versions.json <<EOF
{
  'tag': '$PROD_TAG',
  'commit_hash': '`git rev-list HEAD -1`',
  'cesium': '`grep '"version"' node_modules/cesium/package.json| cut -f4 -d\"`'
}
EOF
scripts/deploy_to_s3.sh prod
git tag $PROD_TAG -m $PROD_TAG
git push origin $PROD_TAG
git push origin prod
