#!/bin/bash -e

RELEASES_BUCKET="ngmpub-review-bgdi-ch"
INT_BUCKET="ngmpub-int-bgdi-ch"
RELEASES_BUCKET="ngmpub-review-bgdi-ch"
PROD_BUCKET="ngmpub-prod-viewer-bgdi-ch"
IMAGE_NAME="camptocamp/swissgeol_api"


if [[ -z "${VERSION}" ]]
then
  echo Missing VERSION environment variable
  exit 1
fi


export AWS_REGION=eu-west-1


function deploy_ui {
  TARGET_BUCKET="$1"
  export AWS_ACCESS_KEY_ID=$(gopass cat ngm/s3/deploybucket/AWS_ACCESS_KEY_ID)
  export AWS_SECRET_ACCESS_KEY=$(gopass cat ngm/s3/deploybucket/AWS_SECRET_ACCESS_KEY)
  if [ "$TARGET_BUCKET" != "$PROD_BUCKET" -a  "$TARGET_BUCKET" != "$INT_BUCKET" ]
  then
    echo wrong target bucket: $TARGET_BUCKET
    exit 1
  fi
  aws s3 sync --delete s3://$RELEASES_BUCKET/releases/$VERSION s3://$TARGET_BUCKET

  if [[ "$TARGET_BUCKET" == "$PROD_BUCKET"  ]]
  then
      echo "Enabling robots.txt on prod"
      aws s3 cp --cache-control max-age=600 s3://$RELEASES_BUCKET/releases/$VERSION/robots_prod.txt s3://$PROD_BUCKET/robots.txt
  fi
}


function deploy_api {
  tag="$1"
  export AWS_ACCESS_KEY_ID=$(gopass cat ngm/fargate/api/AWS_ACCESS_KEY_ID)
  export AWS_SECRET_ACCESS_KEY=$(gopass cat ngm/fargate/api/AWS_SECRET_ACCESS_KEY)
  docker pull $IMAGE_NAME:$VERSION
  docker tag $IMAGE_NAME:$VERSION $IMAGE_NAME:$tag
  docker push $IMAGE_NAME:$tag
  aws ecs update-service --cluster api_$tag --service api_$tag --force-new-deployment
}


if [[ "$1" == "prod" ]]
then
  deploy_api $1
  deploy_ui $PROD_BUCKET
  curl https://viewer.swissgeol.ch/versions.json
  watch --interval=5 curl -s https://viewer.swissgeol.ch/api/health_check
  exit 0
fi

if [[ "$1" == "int" ]]
then
  deploy_api $1
  deploy_ui $INT_BUCKET
  curl https://int.swissgeol.ch/versions.json
  watch --interval=5 curl -s https://int.swissgeol.ch/api/health_check
  exit 0
fi

echo you should pass prod or int parameter
exit 1
