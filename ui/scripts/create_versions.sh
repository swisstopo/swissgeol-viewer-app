#!/bin/bash -e

CSV="`jq '.version' node_modules/cesium/package.json`"
cat > dist/versions.json <<EOF
{
  "build": "`date --iso-8601=minutes`",
  "commit_hash": "`git rev-list HEAD -1`",
  "cesium": $CSV
}
EOF
