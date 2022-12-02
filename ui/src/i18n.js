import i18next from 'i18next';
import locI18next from 'loc-i18next';
import Backend from 'i18next-http-backend';
import {LitElement} from 'lit';
import {SUPPORTED_LANGUAGES} from './constants';
import {getURLSearchParams, setURLSearchParams} from './utils';


class LanguageDetector {
  constructor() {
    this.async = false;
    this.type = 'languageDetector';
  }

  init(services, _, i18nextOptions) {
    this.languageUtils = services.languageUtils;
    this.fallbackLng = i18nextOptions.fallbackLng;
  }

  detect() {
    let language = this.fallbackLng;

    const lang = getURLSearchParams().get('lang');
    // get language from url
    if (this.languageUtils.isSupportedCode(lang)) {
      language = lang;
    } else {
      // fallback to browser's language
      const languages = [];
      if (navigator.languages) {
        languages.push(...navigator.languages);
      } else if (navigator.language) {
        languages.push(navigator.language);
      }
      for (const l of languages) {
        if (this.languageUtils.isSupportedCode(l)) {
          language = l;
          break;
        }
      }
    }
    return this.languageUtils.getLanguagePartFromCode(language);
  }

  cacheUserLanguage(lang) {
    const params = getURLSearchParams();
    params.set('lang', lang);
    setURLSearchParams(params);
  }
}
LanguageDetector.type = 'languageDetector';

export function setupI18n() {
  const promise = i18next.use(Backend).use(LanguageDetector).init({
    ns: ['app', 'assets'],
    defaultNS: 'app',
    supportedLngs: SUPPORTED_LANGUAGES,
    nonExplicitWhitelist: true,
    returnEmptyString: false,
    fallbackLng: 'en',
    //load: 'languageOnly',
    debug: false,
    backend: {
      loadPath: 'locales/{{ns}}.{{lng}}.json'
    }
  });

  const localize = locI18next.init(i18next);

  i18next.on('languageChanged', (lang) => {
    document.documentElement.lang = lang;
    localize('[data-i18n]');
  });
  return promise;
}

/**
 * @param {import('lit-element').LitElement} Base
 */
export class LitElementI18n extends LitElement {

  connectedCallback() {
    this.i18nLanguageChangedCallback_ = () => this.requestUpdate();
    i18next.on('languageChanged', this.i18nLanguageChangedCallback_);
    super.connectedCallback();
  }

  disconnectedCallback() {
    i18next.off('languageChanged', this.i18nLanguageChangedCallback_);
    super.disconnectedCallback();
  }
}

/**
 * @param {string} dateString
 * @return {string}
 */
export function toLocaleDateString(dateString) {
  const date = new Date(dateString);

  return date.toLocaleDateString(`${i18next.language}-CH`, {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}


/**
 * @param {any} property
 * @return string
 */
export function translated(property) {
  return typeof property === 'string' ? property : property[i18next.language];
}
