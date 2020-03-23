#!/bin/bash -e

cat > dist/versions.json <<EOF
{
  'build': '`date --iso-8601=minutes`',
  'commit_hash': '`git rev-list HEAD -1`',
  'cesium': '`grep '"version"' node_modules/cesium/package.json| cut -f4 -d\"`'
}
EOF
