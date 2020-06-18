import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';

/**
 * Creates a random persistent state that is used
 * by amazon cognito and the client to prevent csrf.
 */
function state() {
  if (window.localStorage.getItem('aws_cognito_state') === null) {
    window.localStorage.setItem('aws_cognito_state', Math.random().toString(36).substring(2));
  }
  return window.localStorage.getItem('aws_cognito_state');
}

/**
 * Parses a hash string containing a JWT token and
 * returns its payload (i.e. the user) as an object.
 *
 * @param {*} hash
 */
export function initUser(hash) {
  // transform the hash string into a set of set of properties
  const entries = hash.substring(1).split('&').map(entry => entry.split('='));
  const properties = Object.fromEntries(entries);

  // check wether the required auth properties are present
  if (properties.access_token === undefined
    || properties.state === undefined
    || properties.state !== state()) {
    return undefined;
  }

  // decode and check the size of the jwt token
  const jwt = properties.access_token.split('.');
  if (jwt.length !== 3) {
    return undefined;
  }

  // reload the browser when the auth token expires
  if (properties.expires_in !== undefined
    && !isNaN(parseInt(properties.expires_in))) {
    const expiresIn = parseInt(properties.expires_in) * 1000;
    setInterval(() => {
      location.reload();
    }, expiresIn);
  }

  // decode the base64 payload
  try {
    const payload = atob(jwt[1]);
    return JSON.parse(payload);
  } catch (e) {
    return undefined;
  }
}

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

  login() {
    // redirect to cognito with auth parameters
    document.location = `${this.endpoint}?`
      + `response_type=${this.responseType}`
      + `&client_id=${this.clientId}`
      + `&redirect_uri=${this.redirectUri}`
      + `&scope=${this.scope}`
      + `&state=${state()}`;
  }

  logout() {
    this.user = undefined;
  }

  render() {
    if (this.user === undefined) {
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
