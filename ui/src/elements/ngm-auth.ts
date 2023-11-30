import {html} from 'lit';
import type {AuthUser} from '../auth';
import Auth from '../auth';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import auth from '../store/auth';
import {classMap} from 'lit/directives/class-map.js';
import {customElement, property, state} from 'lit/decorators.js';
import DashboardStore from '../store/dashboard';


/**
 * Authentication component
 */
@customElement('ngm-auth')
export class NgmAuth extends LitElementI18n {
  @property({type: String})
  accessor endpoint: string | undefined;
  @property({type: String})
  accessor clientId: string | undefined;
  @state()
  accessor user: AuthUser | null = null;
  private popup: Window | null = null;

  constructor() {
    super();
    auth.user.subscribe(user => {
      this.user = user;
      if (this.popup) {
        this.popup.close();
        this.popup = null;
      }
    });
  }

  async login() {
    // open the authentication popup
    const url = `${this.endpoint}?`
      + 'response_type=token'
      + `&client_id=${this.clientId}`
      + `&redirect_uri=${location.origin}${location.pathname}`
      + '&scope=openid+profile'
      + `&state=${Auth.state()}`;

    // open the authentication popup
    this.popup = window.open(url);
    // wait for the user to be authenticated
    await Auth.waitForAuthenticate();
    Auth.initialize();
  }

  logout() {
    if (DashboardStore.projectMode.value === 'edit') {
      DashboardStore.showSaveOrCancelWarning(true);
      return;
    }
    Auth.logout();
  }

  render() {
    return html`
      <div class="ngm-user ${classMap({'ngm-active-section': !!this.user})}"
           @click=${!this.user ? this.login : this.logout}>
        <div class="ngm-user-icon"></div>
        ${!this.user ? i18next.t('lsb_login') : i18next.t('lsb_logout')}
      </div>`;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
