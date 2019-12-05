#!/bin/bash

DEV_BRANCH="master"
PROD_BRANCH="prod"
DEPLOY_TO_S3="${DEPLOY_TO_S3:-scripts/deploy_to_s3.sh}"
export SEND_TO_S3="echo"

echo tag $CI_COMMIT_TAG
echo ref $CI_COMMIT_REF_NAME
echo mr $CI_MERGE_REQUEST_SOURCE_BRANCH_NAME

if [ -z "$CI_COMMIT_TAG$CI_COMMIT_REF_NAME" ]
then
  echo "I don't understand what to do. Skipping"
  exit 1
fi

# the "int_*"" tags are deployed to the int environment
# all other tags are ignored
if [ -n "$CI_COMMIT_TAG" ]
then
  NAME="$CI_COMMIT_TAG"
  echo "Deploying tag $NAME"
  if [[ $NAME == int_* ]]
  then
    $DEPLOY_TO_S3 int
    exit $?
  fi

  echo "Not an int tag, skipping"
  exit 0
fi

# merge requests are deploayed to a review directory on the dev environment
if [ -n "$CI_MERGE_REQUEST_SOURCE_BRANCH_NAME" ]
then
  NAME="$CI_MERGE_REQUEST_SOURCE_BRANCH_NAME"
  echo "Deploying merge request $NAME"
  if [[ $NAME == *_GSNGM-* ]]
  then
    $DEPLOY_TO_S3 review $NAME
    exit $?
  fi

  echo "Not a recognized PR name, skipping"
fi

# the DEV_BRANCH branch is deployed to the dev environment
# the PROD_BRANCH branch is deployed to the production environment
# all other branches are ignored
if [ -n "$CI_COMMIT_REF_NAME" ]
then
  NAME="$CI_COMMIT_REF_NAME"
  echo "Deploying branch $NAME"
  if [ "$NAME" = "$DEV_BRANCH" ]
  then
    $DEPLOY_TO_S3 dev
    exit $?
  fi
  if [ "$NAME" = "$PROD_BRANCH" ]
  then
    $DEPLOY_TO_S3 prod
    exit $?
  fi

  echo "Not a managed branch, skipping"
  exit 0
fi

echo "If you see this there is something wrong"
exit 1
