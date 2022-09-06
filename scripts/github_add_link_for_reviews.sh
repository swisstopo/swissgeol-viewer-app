#!/bin/bash -ex

if [[ $GITHUB_EVENT_NAME != "pull_request" ]]
then
  echo "This is not a PR: $GITHUB_EVENT_NAME"
  echo "skipping"
  exit 0
fi

REPO_API_URL="$GITHUB_API_URL/repos/$GITHUB_REPOSITORY"
# GITHUB_REF="refs/pull/1/merge"
PR_ID="`echo $GITHUB_REF | cut -d/ -f 3`"

BRANCH="$GITHUB_HEAD_REF"
DEMO_NOTE="Links: [demo](https://review.swissgeol.ch/$BRANCH/index.html)"

if [[ $BRANCH == *GSNGM-* ]]
then
  JIRA_ISSUE="`echo $BRANCH | sed 's/.*GSNGM/GSNGM/'`"
  JIRA_NOTE="[$JIRA_ISSUE](https://jira.camptocamp.com/browse/$JIRA_ISSUE)"
  DEMO_NOTE="$DEMO_NOTE and $JIRA_NOTE"
fi
if curl --fail -s -H "Accept: application/vnd.github.v3+json" $REPO_API_URL/pulls/$PR_ID/reviews | grep -Fq "$DEMO_NOTE"
then
  echo "Demo link already present, skipping"
  exit
else
  curl -X POST --fail -s -H "Accept: application/vnd.github.v3+json" -H "Authorization: token $GITHUB_TOKEN" -X POST --data "{\"body\": \"$DEMO_NOTE\", \"event\": \"COMMENT\"}" $REPO_API_URL/pulls/$PR_ID/reviews
  exit $?
fi
