#!/bin/sh -e

echo "Compiling Cesium"
cd node_modules/cesium
mv -f gulpfile.js gulpfile.cjs || true
npm i
node_modules/.bin/gulp -f gulpfile.cjs minifyRelease
# save some disk space
rm -fr node_modules/ Documentation/

echo "Cesium compilation finished"
