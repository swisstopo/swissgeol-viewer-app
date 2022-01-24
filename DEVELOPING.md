# Development of the Swisstopo viewer

## Instances

- dev https://dev.swissgeol.ch/
- int https://int.swissgeol.ch/
- prod https://beta.swissgeol.ch/

## Deploy to integration (from local machine)

```bash
# ex int_sprint2.1
export VERSION="int_sprint???"

git tag $VERSION
git push origin $VERSION
```

* Check the site is upgraded: https://int.swissgeol.ch/versions.json

## Deploy to production (from local machine)
```bash
RELEASE_NAME="RELEASE_NAME_FOR_SENTRY" npm run build

export VERSION="THE_TAG_YOU_WANT_DEPLOYED"

git checkout $VERSION
# use gopass to export the S3 access key and secret
export AWS_REGION=eu-west-1
export AWS_ACCESS_KEY_ID=$(gopass show ngm/s3/deploybucket/AWS_ACCESS_KEY_ID)
export AWS_SECRET_ACCESS_KEY=$(gopass show ngm/s3/deploybucket/AWS_SECRET_ACCESS_KEY)

scripts/deploy_to_prod.sh
[ $? -eq 0 ] && echo OK || echo failed
```

* Check the site is upgraded: https://beta.swissgeol.ch/versions.json


## Deploy to prod-viewer (from local machine)
```bash
export VERSION="THE_TAG_YOU_WANT_DEPLOYED"
git checkout $VERSION
RELEASE_NAME="prod_$VERSION" npm run build

# use gopass to export the S3 access key and secret
export AWS_REGION=eu-west-1
export AWS_ACCESS_KEY_ID=$(gopass show ngm/s3/deploybucket/AWS_ACCESS_KEY_ID)
export AWS_SECRET_ACCESS_KEY=$(gopass show ngm/s3/deploybucket/AWS_SECRET_ACCESS_KEY)

scripts/deploy_to_prod_viewer.sh
[ $? -eq 0 ] && echo OK || echo failed
```

* Check the site is upgraded: https://viewer.swissgeol.ch/versions.json


## i18n: add new string to translate

The [i18next](https://www.i18next.com/) library is used to localize the application.

To add a new string to translate, use the `data-i18n` attribute in an html file, the value is the translation key.

```html
<div type="search" data-i18n="text_key"></div>
```

To add a new string in a javascript file, use the `i18next.t` function:
```js
import i18next from 'i18next';

i18next.t('text_key');
```

The properties from all the 3dtiles can be collected for translation using the `extract-from-assets` command:
```bash
export AWS_ACCESS_KEY_ID=$(gopass show ngm/s3/ngm-protected-prod/AWS_ACCESS_KEY_ID)
export AWS_SECRET_ACCESS_KEY=$(gopass show ngm/s3/ngm-protected-prod/AWS_SECRET_ACCESS_KEY)

npm run extract-from-assets
```

Then, run the `npm run extract-i18n` command to add this new key (`text_key`) to the files in the `locales` directory.

## Invalidating some paths from cloudfront

See https://docs.aws.amazon.com/cli/latest/reference/cloudfront/create-invalidation.html

```
aws cloudfront create-invalidation --distribution-id $THE_DISTRIB_ID --paths /somepath
```
