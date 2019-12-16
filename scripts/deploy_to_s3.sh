#!/bin/bash
set -e
set -x

DEV_BUCKET="ngmpub-dev-bgdi-ch"
INT_BUCKET="ngmpub-int-bgdi-ch"
PROD_BUCKET="ngmpub-prod-bgdi-ch"
SYNC_TO_S3="${SYNC_TO_S3:-aws s3 sync --acl public-read}"
CP_TO_S3="${CP_TO_S3:-aws s3 cp --acl public-read}"

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
    $SYNC_TO_S3 --exclude prs --delete dist/ s3://$DEV_BUCKET
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
    EXPIRES="$(date -d '+3 months' --utc +'%Y-%m-%dT%H:%M:%SZ')"
    $CP_TO_S3 --recursive --expires $EXPIRES dist s3://$DEV_BUCKET/prs/$BRANCH/
    exit $?
fi

echo "Unknown env $ENV"
exit 1
