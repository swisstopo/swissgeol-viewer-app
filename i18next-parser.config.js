// see https://github.com/i18next/i18next-parser#options
module.exports = {
  locales: ['de', 'fr', 'it', 'en'],

  input: ['index.html', 'src/**/*.js'],
  output: 'locales/$LOCALE.json',

  createOldCatalogs: false,

  sort: true,
}
