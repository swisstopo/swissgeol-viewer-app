/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
// i18next-scanner.config.cjs
const path = require('node:path');
<<<<<<< HEAD
// import path from 'node:path';
=======
//import path from 'node:path';
>>>>>>> test_viewer

module.exports = {
  options: {
    debug: true,
    sort: true,
    func: {
      list: ['i18next.t', 'i18n.t', 't'],
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
    lngs: ['en', 'de', 'fr', 'it'], // Sprachen, die du verwendest
    ns: ['app', 'assets'], // Namensräume
    defaultNs: 'app',
    defaultValue: '__STRING_NOT_TRANSLATED__',
    resource: {
      loadPath: path.join(__dirname, 'locales/{{ns}}.{{lng}}.json'),
<<<<<<< HEAD
      savePath: path.join(__dirname, 'locales/{{lng}}.{{ns}}-test.json'),
=======
      savePath: path.join(__dirname, 'locales/empty/{{ns}}-{{lng}}-empty.json'),
>>>>>>> test_viewer
    },
    // nsSeparator: '.', // namespace separator
    // keySeparator: false, // key separator
    // merge: false,
<<<<<<< HEAD
    removeUnused: true, // Diese Option sorgt dafür, dass unbenutzte Keys entfernt werden
=======
    // removeUnused: true, // Diese Option sorgt dafür, dass unbenutzte Keys entfernt werden
>>>>>>> test_viewer
  },
  // Hier kannst du auch spezifische Dateien oder Verzeichnisse angeben
  // die gescannt werden sollen
  input: ['index.html', 'src/**/*.js', 'src/**/*.ts'],
};
