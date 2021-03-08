#!/usr/bin/env bash
set -e
set -x

FILENAME="earthquakes.txt"

OLD_RECORDS=$(curl --fail https://download.swissgeol.ch/earthquakes/$FILENAME)

STARTTIME="$(cut -d'|' -f2 <<<"$(echo "$OLD_RECORDS" | sed '2q;d')")"
NOW=$(date +'%FT%H:%M:%S')

NEW_RECORDS=$(curl --fail "http://arclink.ethz.ch/fdsnws/event/1/query?starttime=$STARTTIME&endtime=$NOW&minmagnitude=1&format=text&nodata=404")

echo "$NEW_RECORDS" | tee $FILENAME
echo "$(echo "$OLD_RECORDS" | sed '1,2d')" | tee -a $FILENAME

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

# cat "$NEW_RECORDS\n$(echo "$OLD_RECORDS" | sed '1,2d')"
aws s3 --profile ngmdownload --debug cp --cache-control no-cache $FILENAME s3://ngmpub-download-bgdi-ch/earthquakes/
exit $?
