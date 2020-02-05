import i18next from 'i18next';
import locI18next from 'loc-i18next';
import Backend from 'i18next-xhr-backend';
import {html, render} from 'lit-html';
import {SUPPORTED_LANGUAGES} from './constants.js';


class LanguageDetector {
  constructor() {
    this.async = false;
  }

  init(services, detectorOptions, i18nextOptions) {
    this.whitelist = i18nextOptions.whitelist;
    this.fallbackLng = i18nextOptions.fallbackLng;
  }

  detect() {
    const searchParams = new URLSearchParams(location.search);
    const lang = searchParams.get('lang');
    if (this.isValidLanguage(lang)) {
      // get language from url
      return lang;
    } else {
      // fallback to browser's language
      const languages = [];
      if (navigator.languages) {
        languages.push(...navigator.languages);
      } else if (navigator.language) {
        languages.push(navigator.language);
      }
      for (const lang of languages) {
        if (this.isValidLanguage(lang)) {
          return lang;
        }
      }
    }
    return this.fallbackLng;
  }

  isValidLanguage(lang) {
    return lang && this.whitelist.includes(lang.substr(0, 2).toLowerCase());
  }

  cacheUserLanguage(lang) {
    // FIXME: save to url here ?
  }
}
LanguageDetector.type = 'languageDetector';

export function setupI18n() {
  i18next.use(Backend).use(LanguageDetector).init({
    whitelist: SUPPORTED_LANGUAGES,
    returnEmptyString: false,
    fallbackLng: 'en',
    //load: 'languageOnly',
    debug: true,
    backend: {
      loadPath: 'locales/{{lng}}.json'
    }
  });

  const localize = locI18next.init(i18next);

  i18next.on('languageChanged', (lang) => {
    document.documentElement.lang = lang;
    localize('[data-i18n]');
  });

  const templates = SUPPORTED_LANGUAGES.map(lang => {
    const onclick = evt => {
      i18next.changeLanguage(lang);
      evt.preventDefault();
    };
    return html`
      <a class="item lang-${lang}" @click="${onclick}">${lang.toUpperCase()}</a>
    `;
  });
  render(templates, document.getElementById('langs'));

}
