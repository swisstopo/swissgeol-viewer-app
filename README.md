# Instances

- dev https://dev.swissgeol.ch/
- int https://int.swissgeol.ch/
- prod https://beta.swissgeol.ch/ (username: agch, password: OhnooTh1)

# Deploy to integration (from local machine)

```bash
# ex int_sprint2.1
export VERSION="int_sprint???"

git tag $VERSION
git push origin $VERSION
```

# Deploy to production (from local machine)
```bash
RELEASE_NAME="RELEASE_NAME_FOR_SENTRY" npm run build

export VERSION="THE_TAG_YOU_WANT_DEPLOYED"

git checkout $VERSION
# use gopass to export the S3 access key and secret
export AWS_ACCESS_KEY_ID=$(gopass ngm/s3/deploybucket/AWS_ACCESS_KEY_ID)
export AWS_SECRET_ACCESS_KEY=$(gopass ngm/s3/deploybucket/AWS_SECRET_ACCESS_KEY)

scripts/deploy_to_prod.sh
[ $? -eq 0 ] && echo OK || echo failed
```

# i18n: add new string to translate

The [i18next](https://www.i18next.com/) library is used to localize the application.

To add a new string to translate, use the `data-i18n` attribute in an html file, the value is the translation key.

```html
<div type="search" data-i18n="text_key"></div>
```

Then, run the `npm run extract-i18n` command to add this new key (`text_key`) to the files in the `locales` directory.

# Gitlab <> Jira integration

See https://docs.gitlab.com/ee/user/project/integrations/jira.html

# URL Parameters

- `noLimit` disable the navigation limits (sphere and lava). Use noLimit=false to enforce limits on local dev.
- `assetIds` display some additionnal Cesium ION 3dtilesets (coma separated list of CesiumIon ids)
- `maximumScreenSpaceError` define the visual quality (default: 2.0 except for localhost which is 100.0)
- `ownterrain` activates Swisstopo terrain and restrict to the Swiss rectangle (where there is data)

# Notes

Lava texture CC0 by https://opengameart.org/content/template-orange-texture-pack

Keyboard layout made with [keyboard-layout-editor](http://www.keyboard-layout-editor.com/) and [json to import](https://jira.camptocamp.com/secure/attachment/42145/keyboard-layout_upd.json)
