#!/bin/bash

# TODO: use bats https://github.com/sstephenson/bats

function tester() {
  env="$1"
  param="$2"
  expected="$3"
  echo -n "   env='$env' param='$param' expected='$expected'        "
  OUTPUT=`S3_CMD="echo" CACHE_CONTROL="max-age=42" scripts/deploy_to_s3.sh $env $param`

  if echo $OUTPUT | grep -q "$expected"
  then
    echo -e "\e[32mOK\e[0m"
  else
    echo -e "\e[31mKO\e[0m    "$OUTPUT
    exit 1
  fi
}

echo "Testing sendtos3 is working as expected"
tester dev "" "sync --cache-control max-age=42 --delete --exclude index.html dist/ s3://ngmpub-dev-bgdi-ch \
cp --cache-control no-cache dist/index.html s3://ngmpub-dev-bgdi-ch$"
tester int "" "sync --cache-control max-age=42 --delete --exclude index.html dist/ s3://ngmpub-int-bgdi-ch \
cp --cache-control no-cache dist/index.html s3://ngmpub-int-bgdi-ch$"
tester prod "" "sync --cache-control max-age=42 --delete --exclude index.html dist/ s3://ngmpub-prod-bgdi-ch \
cp --cache-control no-cache dist/index.html s3://ngmpub-prod-bgdi-ch$"
tester review mybranch "sync --cache-control max-age=42 --delete --exclude index.html dist/ s3://ngmpub-review-bgdi-ch/mybranch/ \
cp --cache-control no-cache dist/index.html s3://ngmpub-review-bgdi-ch/mybranch/$"
