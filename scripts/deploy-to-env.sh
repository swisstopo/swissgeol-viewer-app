#!/bin/bash -e

export VERSION=latest
export REGISTRY_PREFIX="docker.io/"

# Use individual image versionning on dev to ensure argocd
# will deploy them (otherwise the tag is the same, latest)
VERSIONNED_SERVICES="swissgeol_api abbreviator"
for svc in $VERSIONNED_SERVICES
do
  kind=`echo $svc| tr [:upper:] [:lower:]`
  export IMAGE_${svc}="${REGISTRY_PREFIX}camptocamp/$svc:$VERSION"
done

for svc in $VERSIONNED_SERVICES
  do
    IMAGE=`echo ${REGISTRY_PREFIX}camptocamp/$svc | tr [:upper:] [:lower:]`
    echo "docker inspect $IMAGE -f '{{ .RepoDigests }}'"
    HASH=`docker inspect $IMAGE -f '{{ .RepoDigests }}' | tr -d '[]' | tr " " "\n" | grep docker.io | cut -d@ -f2`
    if [[ -z $HASH ]]
    then
      echo "Something wrong getting digest of image $IMAGE"
      exit 1
    fi
    export IMAGE_${svc}=$IMAGE@$HASH
    echo Using $IMAGE@$HASH
  done
