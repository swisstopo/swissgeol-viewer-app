import {html} from 'lit';
import type {AuthUser} from '../authService';
import AuthService from '../authService';
import {LitElementI18n} from '../i18n.js';
import auth from '../store/auth';
import {classMap} from 'lit/directives/class-map.js';
import {customElement, property, state} from 'lit/decorators.js';
import DashboardStore from '../store/dashboard';
import {consume} from '@lit/context';
import {authServiceContext} from '../context';

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

  @consume({context: authServiceContext})
  accessor authService!: AuthService;

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
      + `&state=${this.authService.state()}`;

    // open the authentication popup
    this.popup = window.open(url);
    // wait for the user to be authenticated
    await this.authService.waitForAuthenticate();
    this.authService.initialize();
    window.location.reload();
  }

  logout() {
    if (DashboardStore.projectMode.value === 'edit') {
      DashboardStore.showSaveOrCancelWarning(true);
      return;
    }
    this.authService.logout();
  }

  render() {
    return html`
      <div class="ngm-user ${classMap({'ngm-active-section': !!this.user})}"
           @click=${!this.user ? this.login : this.logout}>
          <div class="ngm-user-icon"></div>
      </div>`;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
