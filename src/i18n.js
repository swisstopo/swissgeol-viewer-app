import i18next from 'i18next';
import locI18next from 'loc-i18next';
import Backend from 'i18next-xhr-backend';
import {html, render} from 'lit-html';

import {appError} from './utils.js';

const LANGS = ['de', 'fr', 'it', 'en', 'rm'];

function detectLanguage() {
  // detect language and initialize lang
  const languages = [];
  if (navigator.languages) {
    languages.push(...navigator.languages);
  }
  if (navigator.language) {
    languages.push(navigator.language);
  }

  for (let lang of languages) {
    lang = lang.substr(0, 2).toLowerCase(); // limit to first 2 characters
    if (LANGS.includes(lang)) {
      return lang;
    }
  }
}

export function setupI18n() {
  i18next.use(Backend).init({
    whitelist: LANGS,
    lng: detectLanguage(),
    returnEmptyString: false,
    fallbackLng: 'en',
    //load: 'languageOnly',
    debug: true,
    backend: {
      loadPath: 'locales/{{lng}}.json'
    }
  }, function(err, t) {
    const localize = locI18next.init(i18next);
    function setLanguage(lang) {
      i18next.changeLanguage(lang, (err, t) => {
        if (!err) {
          document.documentElement.lang = lang;
          localize('[data-i18n]');
        } else {
          appError('Could not change language');
        }
      });
    }
    const templates = LANGS.map(lang => {
      const onclick = evt => {
        setLanguage(lang);
        evt.preventDefault();
      };

      return html`
        <a class="item lang-${lang}" @click="${onclick}">${lang.toUpperCase()}</a>
      `;
    });
    render(templates, document.getElementById('langs'));
    setLanguage(i18next.language);
  });
}
