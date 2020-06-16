#!/bin/bash
if [[ $GITHUB_EVENT_NAME == "pull_request" ]]
then
  echo $GITHUB_HEAD_REF
fi

if [[ $GITHUB_EVENT_NAME == "push" ]] && [[ $GITHUB_REF == refs/tags/* ]]
then
  echo $GITHUB_REF| sed 'sYrefs/tags/YY'`
fi
