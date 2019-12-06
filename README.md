# Deploy to production (from local machine)

```
export VERSION="THE_TAG_YOU_WANT_DEPLOYED"

git checkout $VERSION
make secrets.txt
// export AWS secrets

scripts/deploy_to_prod.sh
[ $? -eq 0 ] && echo OK || echo failed
```