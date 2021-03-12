import {LitElementI18n} from '../i18n';
import {html} from 'lit-element';
import {showWarning} from '../message';
import i18next from 'i18next';
import $ from '../jquery';
import 'fomantic-ui-css/components/popup.js';
import './ngm-i18n-content.js';
import {SHORTLINK_HOST_BY_PAGE_HOST} from '../constants';

class NgmShareLink extends LitElementI18n {

  static get properties() {
    return {
      shortlink: {type: String}
    };
  }

  constructor() {
    super();

    this.shortlink = window.location.href;
    this.getShortlink().then(link => {
      this.shortlink = link;
    });
  }

  firstUpdated() {
    const shortlinkPopupKey = navigator.clipboard ? 'welcome_shortlink_copied' : 'welcome_copy_guide';
    // workaround: t('welcome_shortlink_copied')
    // workaround: t('welcome_copy_guide')
    $(this.querySelector('.ngm-share-link > input')).popup({
      on: 'manual',
      position: 'bottom center',
      html: `<ngm-i18n-content key="${shortlinkPopupKey}"></ngm-i18n-content>`,
      variation: 'mini',
      hideOnScroll: true
    });
  }

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
      if (response && response.url_short) {
        return response.url_short;
      }
    } catch (e) {
      console.error(e);
      showWarning(i18next.t('welcome_get_shortlink_error'));
      return window.location.href;
    }
  }

  async onClick() {
    this.toggleLoader();
    try {
      const inputElement = this.querySelector('.ngm-share-link > input');
      this.shortlink = await this.getShortlink();
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(this.shortlink);
      }
      inputElement.select();
      $(inputElement).popup('show');
      setTimeout(() => $(inputElement).popup('hide'), 2000);
      this.toggleLoader();
    } catch (e) {
      console.error(e);
      this.toggleLoader();
    }
  }

  toggleLoader() {
    const btnElement = this.querySelector('.ngm-share-link > button');
    const inputElement = this.querySelector('.ngm-share-link > input');
    btnElement.classList.toggle('disabled');
    inputElement.disabled = !inputElement.disabled;
    btnElement.querySelector('.dimmer').classList.toggle('active');
  }

  render() {
    return html`
      <p>${i18next.t('welcome_share_link_label')}</p>
      <div class="ui mini action input ngm-share-link">
        <input type="text" readonly value="${this.shortlink}" @click=${this.onClick}>
        <button class="ui mini right labeled icon button" @click=${this.onClick}>
          <div class="ui very light dimmer">
            <div class="ui tiny loader"></div>
          </div>
          <i class="copy icon"></i>
          ${i18next.t('welcome_copy_btn_label')}
        </button>
      </div>`;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-share-link', NgmShareLink);
