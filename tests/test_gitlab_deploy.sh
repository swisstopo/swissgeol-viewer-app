#!/bin/bash

# TODO: use bats https://github.com/sstephenson/bats

function tester() {
  tag="$1"
  branch="$2"
  mr="$3"
  expected="$4"
  echo -n "   tag='$tag' branch='$branch' mr='$mr' expected='$expected'        "
  OUTPUT=`DEPLOY_SCRIPT="echo" \
    CI_COMMIT_TAG="$tag" \
    CI_COMMIT_REF_NAME="$branch" \
    CI_MERGE_REQUEST_SOURCE_BRANCH_NAME="$mr" \
    scripts/gitlab_deploy.sh`

  if echo $OUTPUT | grep -q "$expected"
  then
    echo -e "\e[32mOK\e[0m"
  else
    echo -e "\e[31mKO\e[0m    "$OUTPUT
    exit 1
  fi
}


echo "Testing deploy job is working as expected"
tester int "" "" "Not an int tag" # should skip deploying int tag
tester int_something "" "" "deploy_to_s3.sh int" # should deploy int_* tags

tester "" "master" "" "deploy_to_s3.sh dev" # should deploy the master branch
tester "" "prod" "" "deploy_to_s3.sh prod" # should deploy the prod branch

tester "" int int "skipping" # should skip deploying int branch (merge request)
tester "" int blabla_GSNGM-45 "deploy_to_s3.sh review blabla_GSNGM-45" # should skip deploying int branch (merge request)
