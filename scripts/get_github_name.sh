#!/bin/bash
if [[ $GITHUB_EVENT_NAME == "pull_request" ]]
then
  echo $GITHUB_HEAD_REF
fi


if [[ $GITHUB_EVENT_NAME == "push" ]]
then
  # tag refs/tags/XX
  # branch refs/heads/XX
  echo $GITHUB_REF | cut -d/ -f3
fi
