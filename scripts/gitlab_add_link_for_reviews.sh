#!/bin/bash -ex

API_URL="https://git.swisstopo.admin.ch/api/v4"
P_ID="$CI_MERGE_REQUEST_PROJECT_ID"
MR_IID="$CI_MERGE_REQUEST_IID"

MR_API_URL="$API_URL/projects/$P_ID/merge_requests/$MR_IID"

BRANCH="$CI_MERGE_REQUEST_SOURCE_BRANCH_NAME"
JIRA_ISSUE="`echo $BRANCH | sed 's/.*GSNGM/GSNGM/'`"
DEMO_NOTE="Links: [demo](https://s3-eu-west-1.amazonaws.com/ngmpub-dev-bgdi-ch/prs/$BRANCH/index.html) and [jira](https://jira.camptocamp.com/browse/$JIRA_ISSUE)"

if curl --fail -s --header "Private-Token: $MY_API_TOKEN" $MR_API_URL/notes | grep -q "$DEMO_NOTE"
then
  echo "Demo link already present, skipping"
  exit
else
  curl --fail -s --header "Private-Token: $MY_API_TOKEN" -X POST --data-urlencode "body=$DEMO_NOTE" $MR_API_URL/notes
  exit $?
fi
