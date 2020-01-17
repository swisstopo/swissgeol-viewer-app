import i18next from 'i18next';
import locI18next from 'loc-i18next';
import {html, render} from 'lit-html';

import {appError} from './utils.js';

const LANGS = ['de', 'fr', 'it', 'en', 'rm'];

function detectLanguage() {
  // detect language and initialize lang
  let languages = [];
  if (navigator.languages) {
    languages.push(...navigator.languages)
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

  return 'en'; // fallback to English
}

export function init() {
  i18next.init({
    whitelist: LANGS,
    load: 'languageOnly',
    debug: true,
    resources: {
      en: {
        translation: {
          'disclaimer_href': 'https://www.geo.admin.ch/en/about-swiss-geoportal/impressum.html#copyright',
          'disclaimer_text': 'Copyright & data protection',
          'search_placeholder': 'Search...'
        }
      },
      de: {
        translation: {
          'disclaimer_href': 'https://www.geo.admin.ch/de/about-swiss-geoportal/impressum.html#copyright',
          'disclaimer_text': 'Copyright & Datenschutzerklärung',
          'search_placeholder': 'Suchen...'
        }
      },
      fr: {
        translation: {
          'disclaimer_href': 'https://www.geo.admin.ch/fr/about-swiss-geoportal/impressum.html#copyright',
          'disclaimer_text': "Conditions d'utilisation",
          'search_placeholder': 'Rechercher...'
        }
      },
      it: {
        translation: {
          'disclaimer_href': 'https://www.geo.admin.ch/it/about-swiss-geoportal/impressum.html#copyright',
          'disclaimer_text': "Copyright e dichiarazione della protezione dei diritti d'autore",
          'search_placeholder': 'Ricercare...'
        }
      },
      rm: {
        translation: {
          'disclaimer_href': 'https://www.geo.admin.ch/rm/about-swiss-geoportal/impressum.html#copyright',
          'disclaimer_text': 'Copyright & decleraziun da protecziun da datas',
          'search_placeholder': 'Tschertgar...'
        }
      }
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

    const userLang = detectLanguage();
    setLanguage(userLang);
  });
}
