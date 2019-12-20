# Deploy to integration (from local machine)

```bash
export VERSION="int_???"

git tag $VERSION
git push origin $VERSION
```

# Deploy to production (from local machine)

```bash
export VERSION="THE_TAG_YOU_WANT_DEPLOYED"

git checkout $VERSION
make secrets.txt
// export AWS secrets

scripts/deploy_to_prod.sh
[ $? -eq 0 ] && echo OK || echo failed
```

# Gitlab <> Jira integration

See https://docs.gitlab.com/ee/user/project/integrations/jira.html
