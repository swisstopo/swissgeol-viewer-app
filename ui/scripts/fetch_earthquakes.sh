#!/usr/bin/env bash
set -e
set -x


ENDTIME=$(date +'%FT%H:%M:%S')


FILENAME="earthquakes_last_90d.txt"
STARTTIME=$(date -d '-90 days' +'%FT%H:%M:%S')

curl --fail "http://arclink.ethz.ch/fdsnws/event/1/query?starttime=$STARTTIME&endtime=$ENDTIME&minmagnitude=1&format=text&nodata=404" > $FILENAME

aws s3 --debug cp --cache-control no-cache $FILENAME s3://ngmpub-download-bgdi-ch/earthquakes/


FILENAME="earthquakes_magnitude_gt_3.txt"
STARTTIME="1979-01-01T00:00:00"

curl --fail "http://arclink.ethz.ch/fdsnws/event/1/query?starttime=$STARTTIME&endtime=$ENDTIME&minmagnitude=3&format=text&nodata=404" > $FILENAME

aws s3 --debug cp --cache-control no-cache $FILENAME s3://ngmpub-download-bgdi-ch/earthquakes/
