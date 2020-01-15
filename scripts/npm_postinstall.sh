#!/bin/sh -e

echo "Compiling Cesium"
cd node_modules/cesium
mv -f gulpfile.js gulpfile.cjs || true
npm i
node_modules/.bin/gulp -f gulpfile.cjs minifyRelease

echo "Cesium compilation finished"
