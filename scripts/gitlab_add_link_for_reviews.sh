#!/bin/bash -ex

API_URL="https://git.swisstopo.admin.ch/api/v4"
P_ID="$CI_MERGE_REQUEST_PROJECT_ID"
MR_IID="$CI_MERGE_REQUEST_IID"

MR_API_URL="$API_URL/projects/$P_ID/merge_requests/$MR_IID"

DEMO_NOTE="Demo link: https://ngmpub.dev.bgdi.ch/prs/$CI_MERGE_REQUEST_SOURCE_BRANCH_NAME"

if curl --header "Private-Token: $MY_API_TOKEN" $MR_API_URL/notes | grep -q "$DEMO_NOTE"
then
  echo "Demo link already present, skipping"
  exit
else
  curl --header "Private-Token: $MY_API_TOKEN" -X POST $MR_API_URL/notes -d "$DEMO_NOTE"
  exit $?
fi
