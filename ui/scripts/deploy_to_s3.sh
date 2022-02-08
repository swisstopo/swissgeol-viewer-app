#!/bin/bash
set -e
set -x

DEV_BUCKET="ngmpub-dev-bgdi-ch"
INT_BUCKET="ngmpub-int-bgdi-ch"
PROD_BUCKET="ngmpub-prod-bgdi-ch"
REVIEW_BUCKET="ngmpub-review-bgdi-ch"
PROD_VIEWER_BUCKET="ngmpub-prod-viewer-bgdi-ch"
CACHE_CONTROL="${CACHE_CONTROL:-no-cache}"
S3_CMD="${S3_CMD:-aws s3}"

ENV="$1"

if [ "$ENV" = "prod-viewer" ]
then
    DESTINATION="s3://$PROD_VIEWER_BUCKET"
fi

if [ "$ENV" = "prod" ]
then
    DESTINATION="s3://$PROD_BUCKET"
fi

if [ "$ENV" = "int" ]
then
    DESTINATION="s3://$INT_BUCKET"
fi

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

$S3_CMD sync --cache-control $CACHE_CONTROL --delete --exclude 'index.html' --exclude 'Workers/*' dist/ $DESTINATION
$S3_CMD sync --cache-control max-age=600 dist/Workers/ $DESTINATION/Workers
$S3_CMD cp --cache-control no-cache dist/index.html $DESTINATION/index.html
$S3_CMD cp --recursive --cache-control no-cache storybook-static $DESTINATION/storybook-static

if [ "$ENV" = "prod-viewer" ]
then
    $S3_CMD cp --cache-control max-age=600 robots_prod.txt $DESTINATION/robots.txt
fi
