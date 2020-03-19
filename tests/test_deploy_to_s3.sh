#!/bin/bash

# TODO: use bats https://github.com/sstephenson/bats

function tester() {
  env="$1"
  param="$2"
  expected="$3"
  echo -n "*    env=$env param=$param expected=$expected        "
  OUTPUT="`S3_CMD="echo" scripts/deploy_to_s3.sh $env $param`"

  if echo $OUTPUT | grep -q "$expected"
  then
    echo -e "\e[32mOK\e[0m"
  else
    echo -e "\e[31mKO\e[0m    "
    echo "Got      " $OUTPUT
    echo "Expected " $expected
    git diff $(echo $expected | git hash-object -w --stdin) $(echo $OUTPUT | git hash-object -w --stdin)  --word-diff --color
    exit 1
  fi
}

echo "Testing sendtos3 is working as expected"
tester dev "" "sync --cache-control no-cache --delete --exclude index.html --exclude Workers/* dist/ s3://ngmpub-dev-bgdi-ch sync --cache-control max-age=600 dist/Workers/ s3://ngmpub-dev-bgdi-ch/Workers cp --cache-control no-cache dist/index.html s3://ngmpub-dev-bgdi-ch/index.html$"
tester int "" "sync --cache-control no-cache --delete --exclude index.html --exclude Workers/* dist/ s3://ngmpub-int-bgdi-ch sync --cache-control max-age=600 dist/Workers/ s3://ngmpub-int-bgdi-ch/Workers cp --cache-control no-cache dist/index.html s3://ngmpub-int-bgdi-ch/index.html$"
tester prod "" "sync --cache-control no-cache --delete --exclude index.html --exclude Workers/* dist/ s3://ngmpub-prod-bgdi-ch sync --cache-control max-age=600 dist/Workers/ s3://ngmpub-prod-bgdi-ch/Workers cp --cache-control no-cache dist/index.html s3://ngmpub-prod-bgdi-ch/index.html$"
tester review mybranch "sync --cache-control no-cache --delete --exclude index.html --exclude Workers/* dist/ s3://ngmpub-review-bgdi-ch/mybranch sync --cache-control max-age=600 dist/Workers/ s3://ngmpub-review-bgdi-ch/mybranch/Workers cp --cache-control no-cache dist/index.html s3://ngmpub-review-bgdi-ch/mybranch/index.html$"
