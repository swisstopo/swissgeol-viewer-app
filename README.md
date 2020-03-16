# Instances

- dev https://ngmpub.dev.bgdi.ch/
- int https://ngmpub.int.bgdi.ch/
- prod https://ngmpub.prod.bgdi.ch/ (username: agch, password: OhnooTh1)

# Deploy to integration (from local machine)

```bash
RELEASE_NAME="RELEASE_NAME_FOR_SENTRY" npm run build

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
make secrets.txt
// export AWS secrets

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
- `noLimit` disable the navigation limits (sphere and lava)
- `assetIds` display some additionnal Cesium ION 3dtilesets (coma separated list of CesiumIon ids)

# Notes

Lava texture CC0 by https://opengameart.org/content/template-orange-texture-pack
