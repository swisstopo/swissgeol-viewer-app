#!/bin/bash

# TODO: use bats https://github.com/sstephenson/bats

function tester() {
  env="$1"
  param="$2"
  expected="$3"
  echo -n "   env='$env' param='$param' expected='$expected'        "
  OUTPUT=`SEND_TO_S3="echo" scripts/deploy_to_s3.sh $env $param`

  if echo $OUTPUT | grep -q "$expected"
  then
    echo -e "\e[32mOK\e[0m"
  else
    echo -e "\e[31mKO\e[0m    "$OUTPUT
    exit 1
  fi
}

echo "Testing sendtos3 is working as expected"
tester dev "" "dist/ s3://ngmpub_dev_bdgi_ch/"
tester int "" "dist/ s3://ngmpub_int_bdgi_ch/"
tester prod "" "dist/ s3://ngmpub_prod_bdgi_ch/"
tester review mybranch "" "dist/ s3://ngmpub_dev_bdgi_ch/prs/mybranch"
