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
    this.updateLogoutTimeout_(this.user);
    this.responseType = 'token';
    this.redirectUri = `${location.origin}${location.pathname}`;
    this.scope = 'openid+profile';
  }

  /**
   * Set or clear auto logout timer.
   * @param claims
   */
  updateLogoutTimeout_(claims) {
    if (this.expireTimer_) {
      clearTimeout(this.expireTimer_);
      this.expireTimer_ = null;
    }
    if (claims) {
      const expiresIn = 1000 * claims.exp - Date.now();
      if (expiresIn > 0) {
        console.log('setting logout timeout in', expiresIn, 'milliseconds');
        this.expireTimer_ = setTimeout(() => {
          console.log('The token has expired, triggering logout');
          this.logout();
        }, expiresIn);
      }
    }
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
    Auth.initialize();
    this.user = Auth.getUser();
    console.assert(this.user);
    this.updateLogoutTimeout_(this.user);

    // close the authentication popup
    popup.close();

    this.dispatchEvent(new CustomEvent('refresh', {detail: {authenticated: true}}));
  }

  logout() {
    Auth.logout();
    this.user = null;
    this.updateLogoutTimeout_();

    this.dispatchEvent(new CustomEvent('refresh', {detail: {authenticated: false}}));
  }

  render() {
    if (!this.user) {
      return html`<a @click=${this.login}>${i18next.t('header_login_label')}</a>`;
    } else {
      return html`${this.user.username} <a @click=${this.logout}>${i18next.t('header_logout_label')}</a>`;
    }
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-auth', NgmAuth);
