# Development of the Swisstopo viewer

## Architecture

Diagram: https://docs.google.com/drawings/d/1DnW5C1tzltZOaQHZYL5aoncyJNL6f12akIKk024qPqE


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
export AWS_ACCESS_KEY_ID=$(gopass cat ngm/s3/ngm-protected-prod/AWS_ACCESS_KEY_ID)
export AWS_SECRET_ACCESS_KEY=$(gopass cat ngm/s3/ngm-protected-prod/AWS_SECRET_ACCESS_KEY)

npm run extract-from-assets
```

Then, run the `npm run extract-i18n` command to add this new key (`text_key`) to the files in the `locales` directory.
