#!/bin/bash
set -e

DEV_BUCKET="ngmpub_dev_bdgi_ch"
INT_BUCKET="ngmpub_int_bdgi_ch"
PROD_BUCKET="ngmpub_prod_bdgi_ch"
SEND_TO_S3="${SEND_TO_S3:-aws s3 sync}"

function send_to_s3() {
  BUCKET="$1"
  PATH="$2"
  $SEND_TO_S3 --delete --exclude prs dist/ s3://$BUCKET/$PATH

}

echo Called $0 $*

ENV="$1"

if [ "$ENV" = "prod" ]
then
    send_to_s3 $PROD_BUCKET
    exit $?
fi

if [ "$ENV" = "int" ]
then
    send_to_s3 $INT_BUCKET
    exit $?
fi

if [ "$ENV" = "dev" ]
then
    send_to_s3 $DEV_BUCKET
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
    send_to_s3 $DEV_BUCKET /prs/$BRANCH
    exit $?
fi

echo "Unknown env $ENV"
exit 1
