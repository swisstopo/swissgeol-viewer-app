#!/usr/bin/env bash
set -e
set -x

FILENAME="earthquakes.txt"

ENDTIME=$(date +'%FT%H:%M:%S')
STARTTIME=$(date -d '-90 days' +'%FT%H:%M:%S')

curl --fail "http://arclink.ethz.ch/fdsnws/event/1/query?starttime=$STARTTIME&endtime=$ENDTIME&minmagnitude=1&format=text&nodata=404" > $FILENAME

aws s3 --debug cp --cache-control no-cache $FILENAME s3://ngmpub-download-bgdi-ch/earthquakes/
