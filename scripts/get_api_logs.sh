#!/bin/bash

export AWS_DEFAULT_REGION=eu-west-1
export AWS_ACCESS_KEY_ID=$(gopass cat ngm/cloudwatch/AWS_ACCESS_KEY_ID)
export AWS_SECRET_ACCESS_KEY=$(gopass cat ngm/cloudwatch/AWS_SECRET_ACCESS_KEY)

if [[ "$1" != "dev" &&  "$1" != "int" &&  "$1" != "prod" ]]
then
  echo First argument should be dev/int/prod
  exit 1
fi


STREAM_NAME="`aws logs describe-log-streams --log-group-name api_$1 | jq  --raw-output '.logStreams | max_by(.lastEventTimestamp).logStreamName'`"
echo Getting log for $STREAM_NAME
aws logs get-log-events --log-group-name api_$1 --log-stream-name $STREAM_NAME --out text
