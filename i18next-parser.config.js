// see https://github.com/i18next/i18next-parser#options
module.exports = {
  locales: ['de', 'fr', 'it', 'en'],
  defaultNamespace: 'app',

  input: ['index.html', 'src/**/*.js'],
  output: 'locales/$NAMESPACE.$LOCALE.json',

  createOldCatalogs: false,

  sort: true,
}
