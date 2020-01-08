#!/bin/bash
set -e
set -x

DEV_BUCKET="ngmpub-dev-bgdi-ch"
INT_BUCKET="ngmpub-int-bgdi-ch"
PROD_BUCKET="ngmpub-prod-bgdi-ch"
REVIEW_BUCKET="ngmpub-review-bgdi-ch"
SYNC_TO_S3="${SYNC_TO_S3:-aws s3 sync --acl public-read}"

ENV="$1"

if [ "$ENV" = "prod" ]
then
    $SYNC_TO_S3 --delete dist/ s3://$PROD_BUCKET
    exit $?
fi

if [ "$ENV" = "int" ]
then
    $SYNC_TO_S3 --delete dist/ s3://$INT_BUCKET
    exit $?
fi

if [ "$ENV" = "dev" ]
then
    $SYNC_TO_S3 --delete dist/ s3://$DEV_BUCKET
    exit $?
fi

if [ "$ENV" = "review" ]
then
    BRANCH="$2"
    if [ -z "$BRANCH" ]
    then
      echo "Missing branch name for review env"
      exit 1
    fi
    $SYNC_TO_S3 --delete dist/ s3://$REVIEW_BUCKET/$BRANCH/
    exit $?
fi

echo "Unknown env $ENV"
exit 1
