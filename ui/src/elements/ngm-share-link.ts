import { LitElementI18n } from '../i18n';
import { html } from 'lit';
import { showBannerSuccess, showBannerWarning } from '../notifications';
import i18next from 'i18next';
import 'fomantic-ui-css/components/popup.js';
import './ngm-i18n-content.js';
import { SHORTLINK_URL_BY_PAGE_HOST } from '../constants';
import { classMap } from 'lit/directives/class-map.js';
import { customElement, query, state } from 'lit/decorators.js';

@customElement('ngm-share-link')
export class NgmShareLink extends LitElementI18n {
  @state()
  accessor shortlink = '';
  @state()
  accessor displayLoader = false;
  @query('.ngm-toast-placeholder')
  accessor toastPlaceholder;

  async getShortlink() {
    const serviceUrl = SHORTLINK_URL_BY_PAGE_HOST[window.location.host];
    const url = window.location.href;
    try {
      const response = await fetch(serviceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
        },
        body: JSON.stringify({
          url: url,
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Service response status ${response.status}: ${await response.text()}`,
        );
      } else if (response.headers.has('location')) {
        return response.headers.get('location')!;
      } else {
        throw new Error('Location header is missing');
      }
    } catch (e) {
      console.error(e);
      showBannerWarning(
        this.toastPlaceholder,
        i18next.t('welcome_get_shortlink_error'),
      );
      return url;
    }
  }

  async connectedCallback() {
    this.onConnect();
    super.connectedCallback();
  }

  async onConnect() {
    this.shortlink = await this.getShortlink();
  }

  async onClick() {
    if (!this.shortlink) return;
    try {
      await navigator.clipboard.writeText(this.shortlink);
      showBannerSuccess(this.toastPlaceholder, i18next.t('shortlink_copied'));
    } catch (e) {
      console.error(e);
    }
  }

  render() {
    return html`
      <div class="ngm-toast-placeholder"></div>
      <div class="ngm-share-label">
        ${i18next.t('shortlink_copy_btn_label')}
      </div>
      <div class="ngm-input ${classMap({ disabled: this.displayLoader })}">
        <input
          type="text"
          placeholder="required"
          readonly
          .value=${this.shortlink}
        />
        <button
          class="ngm-copy-icon-btn ${classMap({
            disabled: this.displayLoader,
          })}"
          @click=${this.onClick}
        >
          <div class="ngm-copy-icon icon"></div>
        </button>
        <span class="ngm-floating-label"
          >${i18next.t('shortlink_link_label')}</span
        >
      </div>
      <a
        class="ui button ngm-action-btn ${classMap({
          disabled: this.displayLoader,
        })}"
        target="_blank"
        href="mailto:?body=${this.shortlink}"
      >
        ${i18next.t('shortlink_mailto_btn_label')}
      </a>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
