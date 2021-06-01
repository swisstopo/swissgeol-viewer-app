#!/bin/bash -e

mkdir -p dist/legal/

for file in legal/*.md; do
  marked -i $file -o dist/${file/.md/.html};
done
