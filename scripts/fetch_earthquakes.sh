#!/usr/bin/env bash
set -e
set -x

FILENAME="earthquakes.txt"
TEMPFILE="earthquakes_temp.txt"

LATEST=$(sed '2q;d' $FILENAME)
STARTTIME="$(cut -d'|' -f2 <<<"$LATEST")"
NOW=$(date +'%FT%H%M%S')

URL="http://arclink.ethz.ch/fdsnws/event/1/query?starttime=${STARTTIME}&endtime=${NOW}&minmagnitude=1&format=text&nodata=404"
echo "$URL"

RECORDS=$(curl --fail $URL)

echo "$RECORDS" | tee $TEMPFILE
echo "$(sed 1,2d $FILENAME)" | tee -a $TEMPFILE
mv $TEMPFILE $FILENAME
