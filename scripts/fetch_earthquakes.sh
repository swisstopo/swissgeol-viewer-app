#!/usr/bin/env bash
set -e
set -x

FILENAME="earthquakes.txt"

ENDTIME=$(date +'%FT%H:%M:%S')
STARTTIME=$(date -d '-90 days' +'%FT%H:%M:%S')

curl --fail "http://arclink.ethz.ch/fdsnws/event/1/query?starttime=$STARTTIME&endtime=$ENDTIME&minmagnitude=1&format=text&nodata=404" > $FILENAME

# if no AWS config exists, create it.
if [[ ! -d ~/.aws ]] ; then
  mkdir ~/.aws
fi

set +x # do not output AWS credentials on a public github action!!!!
cat >> ~/.aws/config << EOF
[profile ngmdownload]
aws_access_key_id=${AWS_ACCESS_KEY_ID}
aws_secret_access_key=${AWS_SECRET_ACCESS_KEY}
region=eu-west-1
EOF
set -x

aws s3 --profile ngmdownload --debug cp --cache-control no-cache $FILENAME s3://ngmpub-download-bgdi-ch/earthquakes/
exit $?
