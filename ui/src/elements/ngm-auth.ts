import { css, html } from 'lit';
import type { AuthUser } from '../authService';
import AuthService from '../authService';
import { LitElementI18n } from '../i18n.js';
import auth from '../store/auth';
import { customElement, property, state } from 'lit/decorators.js';
import DashboardStore from '../store/dashboard';
import { consume } from '@lit/context';
import { authServiceContext } from '../context';
import '../components/core';

/**
 * Authentication component
 */
@customElement('ngm-auth')
export class NgmAuth extends LitElementI18n {
  @property({ type: String })
  accessor endpoint: string | undefined;
  @property({ type: String })
  accessor clientId: string | undefined;
  @state()
  accessor user: AuthUser | null = null;
  private popup: Window | null = null;

  @consume({ context: authServiceContext })
  accessor authService!: AuthService;

  constructor() {
    super();
    auth.user.subscribe((user) => {
      this.user = user;
      if (this.popup) {
        this.popup.close();
        this.popup = null;
      }
    });
  }

  async login() {
    // open the authentication popup
    const url =
      `${this.endpoint}?` +
      'response_type=token' +
      `&client_id=${this.clientId}` +
      `&redirect_uri=${location.origin}${location.pathname}` +
      '&scope=openid+profile' +
      `&state=${this.authService.state()}`;

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

  readonly render = () => html`
    <div @click=${this.user ? this.logout : this.login}>
      <ngm-core-icon icon="user"></ngm-core-icon>
    </div>
  `;

  static readonly styles = css`
    div {
      color: var(--color-bg);
      background-color: var(--color-main);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
    }

    ngm-core-icon {
      width: 20px;
      height: 20px;
    }
  `;
}
