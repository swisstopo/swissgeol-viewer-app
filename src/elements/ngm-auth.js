import {LitElement, html} from 'lit-element';
import Auth from '../auth.js';

/**
 * Authentication component
 */
class NgmAuth extends LitElement {

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
    const uri = `${this.endpoint}?`
      + `response_type=${this.responseType}`
      + `&client_id=${this.clientId}`
      + `&redirect_uri=${this.redirectUri}`
      + `&scope=${this.scope}`
      + `&state=${Auth.state()}`;

    // open the authentication popup
    const popup = window.open(uri);

    // wait for the user to be authenticated
    await Auth.authenticate();
    this.user = Auth.getUser();

    // close the authentication popup
    popup.close();
  }

  logout() {
    Auth.removeUser();
    this.user = Auth.getUser();
  }

  render() {
    if (this.user === null) {
      return html`<a @click=${this.login}>Login</a>`;
    } else {
      return html`${this.user.username} <a @click=${this.logout}>Logout</a>`;
    }
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-auth', NgmAuth);
