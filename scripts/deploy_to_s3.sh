#!/bin/bash
set -e

DEV_BUCKET="ngmpub_dev_bdgi_ch"
INT_BUCKET="ngmpub_int_bdgi_ch"
PROD_BUCKET="ngmpub_prod_bdgi_ch"
SEND_TO_S3="${SEND_TO_S3:-aws s3 sync}"

ENV="$1"

if [ "$ENV" = "prod" ]
then
    $SEND_TO_S3 --delete dist/ s3://$PROD_BUCKET
    exit $?
fi

if [ "$ENV" = "int" ]
then
    $SEND_TO_S3 --delete dist/ s3://$INT_BUCKET
    exit $?
fi

if [ "$ENV" = "dev" ]
then
    $SEND_TO_S3 --exclude prs --delete dist/ s3://$DEV_BUCKET
    exit $?
fi

if [ "$ENV" = "review" ]
then
    BRANCH="$1"
    if [ -z "$BRANCH" ]
    then
      echo "Missing branch name for review env"
      exit 1
    fi
    EXPIRES="$(date -d '+3 months' --utc +'%Y-%m-%dT%H:%M:%SZ')"
    $SEND_TO_S3 --expires $EXPIRES --delete dist/ s3://$DEV_BUCKET/prs/$BRANCH
    exit $?
fi

echo "Unknown env $ENV"
exit 1
