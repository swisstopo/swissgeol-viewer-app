#!/bin/bash -e

INT_BUCKET="ngmpub-int-bgdi-ch"
DEV_BUCKET="ngmpub-dev-bgdi-ch"
RELEASES_BUCKET="ngmpub-releases-bgdi-ch"
PROD_BUCKET="ngmpub-prod-viewer-bgdi-ch"
IMAGE_NAME="camptocamp/swissgeol_api"


if [[ "$1" == "dev" ]]
then
  export VERSION="latest"
fi

if [[ -z "${VERSION}" ]]
then
  echo Missing VERSION environment variable
  exit 1
fi


export AWS_REGION=eu-west-1


function deploy_ui {
  TARGET_BUCKET="$1"
  export AWS_ACCESS_KEY_ID=$(gopass cat ngm/s3/$RELEASES_BUCKET/AWS_ACCESS_KEY_ID)
  export AWS_SECRET_ACCESS_KEY=$(gopass cat ngm/s3/$RELEASES_BUCKET/AWS_SECRET_ACCESS_KEY)
  if [ "$TARGET_BUCKET" != "$PROD_BUCKET" -a  "$TARGET_BUCKET" != "$INT_BUCKET" -a "$TARGET_BUCKET" != "$DEV_BUCKET" ]
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
  export AWS_ACCESS_KEY_ID=$(gopass cat ngm/fargate/api/AWS_ACCESS_KEY_ID) # todo remove when k8s migration done
  export AWS_SECRET_ACCESS_KEY=$(gopass cat ngm/fargate/api/AWS_SECRET_ACCESS_KEY) # todo remove when k8s migration done
  docker pull $IMAGE_NAME:$VERSION
  docker tag $IMAGE_NAME:$VERSION $IMAGE_NAME:$tag
  docker push $IMAGE_NAME:$tag
  aws ecs update-service --region $AWS_REGION --cluster api_$tag --service api_$tag --force-new-deployment # todo remove when k8s migration done
# ./scripts/deploy-to-env.sh "$1"  uncomment when k8s migration done
}


if [[ "$1" == "prod" ]]
then
  deploy_api prod
  deploy_ui $PROD_BUCKET
  curl https://viewer.swissgeol.ch/versions.json
  watch --interval=5 curl -s https://api.viewer.swissgeol.ch/api/health_check
  exit 0
fi

if [[ "$1" == "int" ]]
then
  deploy_api int
  deploy_ui $INT_BUCKET
  curl https://int-viewer.swissgeol.ch/versions.json
  watch --interval=5 curl -s https://api.int-viewer.swissgeol.ch/api/health_check
  exit 0
fi

if [[ "$1" == "dev" ]]
then
  echo "Special api-only deploy"
  ./deploy-to-env "$1"
  watch --interval=5 curl -s https://api.dev-viewer.swissgeol.ch/api/health_check
  exit 0
fi

echo you should pass prod, int, or dev parameter
exit 1
