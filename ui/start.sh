#!/bin/bash

# Install latest dependencies.
npm ci --no-audit

# Remove previous build output.
rm -r dist/*

# Start the development server.
npm run start
