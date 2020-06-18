#!/bin/bash

DEV_BRANCH="master"
PROD_BRANCH="prod"
DEPLOY_TO_S3="${DEPLOY_TO_S3:-scripts/deploy_to_s3.sh}"

echo ref $GITHUB_REF
echo head_ref $GITHUB_HEAD_REF


if [[ $GITHUB_EVENT_NAME == "pull_request" ]]
then
  echo "It is a PR"
  export BRANCH_NAME=$GITHUB_HEAD_REF
fi

if [[ $GITHUB_EVENT_NAME == "push" ]]
then
  if [[ $GITHUB_REF == refs/tags/* ]]
  then
    echo "It is a tag"
    export TAG_NAME=`echo $GITHUB_REF | cut -d/ -f3`
  fi
  if [[ $GITHUB_REF == refs/heads/* ]]
  then
    echo "It is a branch push"
    export BRANCH_NAME=`echo $GITHUB_REF | cut -d/ -f3`
  fi
fi
echo tag $TAG_NAME
echo ref $BRANCH_NAME

if [ -z "$TAG_NAME$BRANCH_NAME" ]
then
  echo "I don't understand what to do. Skipping"
  exit 1
fi

# the "int_*"" tags are deployed to the int environment
# all other tags are ignored
if [ -n "$TAG_NAME" ]
then
  NAME="$TAG_NAME"
  echo "Deploying tag $NAME"
  if [[ $NAME == int_* ]]
  then
    $DEPLOY_TO_S3 int
    exit $?
  fi

  echo "Not an int tag, skipping"
  exit 0
fi

# the DEV_BRANCH branch is deployed to the dev environment
# the PROD_BRANCH branch is deployed to the production environment
# all the other branches are deployed to the review environment
if [ -n "$BRANCH_NAME" ]
then
  NAME="$BRANCH_NAME"
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

  $DEPLOY_TO_S3 review $NAME
  exit $?
fi

echo "If you see this there is something wrong"
exit 1
