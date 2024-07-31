#!/bin/bash -e

target=$1  # dev, int, prod

if [[ $target = "dev" ]]
then
  echo "On dev, forcing version to latest"
  export VERSION=latest
elif [[ "$target" = "prod" || "$target" = "int" ]] && [[ -z $VERSION ]]
then
  echo "VERSION should be defined to deploy to int and prod envs"
  exit 2
fi

function get_image_hash() {
  local svc="$1"

  local IMAGE=$(echo ghcr.io/swisstopo/$svc | tr [:upper:] [:lower:])
  echo "docker inspect $IMAGE -f '{{ .RepoDigests }}'"
  local HASH=$(docker inspect $IMAGE -f '{{ .RepoDigests }}' | tr -d '[]' | tr " " "\n" | cut -d@ -f2)

  if [[ -z $HASH ]]; then
    echo "Something wrong getting digest of image $IMAGE"
    exit 1
  fi

  echo Using $HASH for $IMAGE

  retval=$HASH
}
rm -rf argocd
[ ! -e argocd ] && (echo cloning apps && git clone git@git.swisstopo.admin.ch:ngm/argocd.git)
cd argocd/
git checkout $target
git pull
cd apps
file="./api/tag_value.yaml"
IMAGE_TAG=""
if [ "$target" = "dev" ]; then
  get_image_hash "swissgeol-viewer-app-api"
  IMAGE_TAG=$VERSION@$retval
elif [[ "$target" = "prod" || "$target" = "int" ]]; then
  IMAGE_TAG=$VERSION
fi
if [[ -z $IMAGE_TAG ]]; then
    echo "Something went wrong. Version: $VERSION"
    exit 1
  fi
echo "Processing $file"
cat > $file << EOM
image:
  tag: "$IMAGE_TAG"
EOM
cd ../

git add -A .
git commit -m "dev iteration"
git push origin $target
THE_TAG="${target}_`date +'%Y-%m-%d'`_$VERSION"
[ "$target" = "prod" ] || [ "$target" = "int" ] && (git tag -f $THE_TAG -m $THE_TAG; git push -f origin $THE_TAG)
cd ../
rm -rf argocd

if [[ -n $CI ]]
then
  echo "In CI: skipping argocd SYNC (auto-sync enabled)"
else
  # Ask argocd to sync the app
  ARGOCD_SERVER="dev-argocd.swissgeol.ch"
  echo argocd login --sso $ARGOCD_SERVER
  argocd --grpc-web app sync api-${target} --prune --force --server $ARGOCD_SERVER
fi

echo "the end"
