import {LitElementI18n} from '../i18n';
import {html} from 'lit';
import {showSnackbarInfo, showWarning} from '../notifications';
import i18next from 'i18next';
import 'fomantic-ui-css/components/popup.js';
import './ngm-i18n-content.js';
import {SHORTLINK_HOST_BY_PAGE_HOST} from '../constants';
import {classMap} from 'lit/directives/class-map.js';
import {customElement, state} from 'lit/decorators.js';

@customElement('ngm-share-link')
export class NgmShareLink extends LitElementI18n {
  @state() shortlink = '';
  @state() displayLoader = false;

  async getShortlink() {
    const serviceHost = SHORTLINK_HOST_BY_PAGE_HOST[window.location.host];
    try {
      const result = await fetch(`https://${serviceHost}/admin_shrink_url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8'
        },
        body: JSON.stringify({
          'url_long': window.location.href,
          'cdn_prefix': serviceHost
        }),
      });
      const response = await result.json();
      return response ? response.url_short : undefined;
    } catch (e) {
      console.error(e);
      showWarning(i18next.t('welcome_get_shortlink_error'));
      return window.location.href;
    }
  }

  async connectedCallback() {
    this.onConnect();
    super.connectedCallback();
  }

  async onConnect() {
    this.displayLoader = true;
    this.shortlink = await this.getShortlink();
    this.displayLoader = false;
  }

  async onClick() {
    if (!this.shortlink) return;
    try {
      await navigator.clipboard.writeText(this.shortlink);
      showSnackbarInfo(i18next.t('shortlink_copied'));
    } catch (e) {
      console.error(e);
    }
  }

  render() {
    return html`
      <div class="ui very light dimmer ${classMap({active: this.displayLoader})}">
        <div class="ui loader"></div>
      </div>
      <div class="ngm-share-label">${i18next.t('shortlink_copy_btn_label')}</div>
      <div class="ngm-input ${classMap({disabled: this.displayLoader})}">
        <input type="text" placeholder="required" readonly
               .value=${this.shortlink}/>
        <span class="ngm-floating-label">${i18next.t('shortlink_link_label')}</span>
      </div>
      <button class="ui button ngm-action-btn ${classMap({disabled: this.displayLoader})}" @click=${this.onClick}>
        ${i18next.t('shortlink_copy_btn_label')}
      </button>`;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
