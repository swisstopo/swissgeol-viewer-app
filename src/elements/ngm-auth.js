import {LitElement, html} from 'lit-element';
import Auth from '../auth.js';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';

/**
 * Authentication component
 */
class NgmAuth extends I18nMixin(LitElement) {

  static get properties() {
    return {
      user: {type: Object},

      // OAuth2 parameters
      endpoint: {type: String},
      responseType: {type: String},
      clientId: {type: String},
      redirectUri: {type: String},
      scope: {type: String}
    };
  }

  constructor() {
    super();
    this.user = Auth.getUser();

    this.responseType = 'token';
    this.redirectUri = `${location.origin}${location.pathname}`;
    this.scope = 'openid+profile';
  }

  async login() {
    // open the authentication popup
    const url = `${this.endpoint}?`
      + `response_type=${this.responseType}`
      + `&client_id=${this.clientId}`
      + `&redirect_uri=${this.redirectUri}`
      + `&scope=${this.scope}`
      + `&state=${Auth.state()}`;

    // open the authentication popup
    const popup = window.open(url);

    // wait for the user to be authenticated
    await Auth.waitForAuthenticate();
    this.user = Auth.getUser();

    // close the authentication popup
    popup.close();
  }

  logout() {
    Auth.clear();
    this.user = Auth.getUser();
  }

  render() {
    if (!this.user) {
      return html`<a @click=${this.login}>${i18next.t('Login')}</a>`;
    } else {
      return html`${this.user.username} <a @click=${this.logout}>${i18next.t('Logout')}</a>`;
    }
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-auth', NgmAuth);
