#!/bin/bash -ex

API_URL="https://git.swisstopo.admin.ch/api/v4"
P_ID="$CI_MERGE_REQUEST_PROJECT_ID"
MR_IID="$CI_MERGE_REQUEST_IID"

MR_API_URL="$API_URL/projects/$P_ID/merge_requests/$MR_IID"

BRANCH="$CI_MERGE_REQUEST_SOURCE_BRANCH_NAME"
DEMO_NOTE="Links: [demo](https://review.swissgeol.ch/$BRANCH/index.html)"

if [[ $BRANCH == *GSNGM-* ]]
then
  JIRA_ISSUE="`echo $BRANCH | sed 's/.*GSNGM/GSNGM/'`"
  DEMO_NOTE="$DEMO_NOTE and $JIRA_ISSUE"
fi
if curl --fail -s --header "Private-Token: $MY_API_TOKEN" $MR_API_URL/notes | grep -Fq "$DEMO_NOTE"
then
  echo "Demo link already present, skipping"
  exit
else
  curl --fail -s --header "Private-Token: $MY_API_TOKEN" -X POST --data-urlencode "body=$DEMO_NOTE" $MR_API_URL/notes
  exit $?
fi
