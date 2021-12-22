#!/bin/bash
node_modules/.bin/sentry-cli releases files `git rev-parse --abbrev-ref HEAD` upload-sourcemaps --ext ts --ext js --ext map dist --validate

