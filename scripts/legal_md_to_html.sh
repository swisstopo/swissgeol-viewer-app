#!/bin/bash -e

mkdir -p dist/legal/
cp legal/index.css dist/legal/

template=$(<legal/template.html)

for file in legal/*.md; do
  html=$(marked -i $file)
  echo "${template//_CONTENT_/$html}" > dist/${file/.md/.html}
done
