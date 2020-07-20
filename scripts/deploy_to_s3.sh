#!/bin/bash
set -e
set -x

DEV_BUCKET="ngmpub-dev-bgdi-ch"
INT_BUCKET="ngmpub-int-bgdi-ch"
PROD_BUCKET="ngmpub-prod-bgdi-ch"
REVIEW_BUCKET="ngmpub-review-bgdi-ch"
CACHE_CONTROL="${CACHE_CONTROL:-no-cache}"
S3_CMD="${S3_CMD:-aws s3 --debug --profile ngmdeploy}"

ENV="$1"

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

# if no AWS config exists, create it.
if [[ ! -d ~/.aws ]] ; then
  mkdir ~/.aws
fi

if [[  ! -r ~/.aws/config ]] || [ -z "$(grep ngmdeploy ~/.aws/config)" ] ; then
set +x # do not output AWS credentials on a public github action!!!!
  cat >> ~/.aws/config << EOF
[profile ngmdeploy]
aws_access_key_id=${AWS_ACCESS_KEY_ID}
aws_secret_access_key=${AWS_SECRET_ACCESS_KEY}
region=eu-west-1
EOF
set -x
fi

$S3_CMD sync --cache-control $CACHE_CONTROL --delete --exclude 'index.html' --exclude 'Workers/*' dist/ $DESTINATION
$S3_CMD sync --cache-control max-age=600 dist/Workers/ $DESTINATION/Workers
$S3_CMD cp --cache-control no-cache dist/index.html $DESTINATION/index.html
exit $?
