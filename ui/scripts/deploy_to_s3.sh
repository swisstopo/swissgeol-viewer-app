#!/bin/bash
set -e
set -x

DEV_BUCKET="ngmpub-dev-bgdi-ch"
INT_BUCKET="ngmpub-int-bgdi-ch"
REVIEW_BUCKET="ngmpub-review-bgdi-ch"
PROD_VIEWER_BUCKET="ngmpub-prod-viewer-bgdi-ch"
CACHE_CONTROL="${CACHE_CONTROL:-no-cache}"
S3_CMD="${S3_CMD:-aws s3}"

ENV="$1"

if [ "$ENV" = "dev" ]
then
    DESTINATION="s3://$DEV_BUCKET"
fi

if [ "$ENV" = "review" ]
then
    BRANCH="$2"
    if [ -z "$BRANCH" ]
    then
      echo "Missing branch name for review env"
      exit 1
    fi
    DESTINATION="s3://$REVIEW_BUCKET/$BRANCH"
fi

if [ -z "$DESTINATION" ]
then
    echo "Unknown env $ENV"
    exit 1
fi

# if you change something here change also there
$S3_CMD sync --cache-control $CACHE_CONTROL --delete --exclude 'index.html' --exclude 'Workers/*' dist/ $DESTINATION
$S3_CMD sync --cache-control max-age=600 dist/Workers/ $DESTINATION/Workers
$S3_CMD cp --cache-control no-cache dist/index.html $DESTINATION/index.html
