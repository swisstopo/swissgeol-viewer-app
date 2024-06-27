import {html} from 'lit';
import {LitElementI18n} from '../i18n';
import i18next from 'i18next';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';


class NgmTrackingConsent extends LitElementI18n {
  static get properties() {
    return {
      allowed: {type: Boolean},
    };
  }

  constructor() {
    super();
    this.allowed = !location.href.includes('localhost') ? null : false;
  }

  updated(changedProperties) {
    if (changedProperties.has('allowed') && this.allowed !== null) {
      this.dispatchEvent(new CustomEvent('change', {
        detail: {
          allowed: this.allowed
        }
      }));
    }
  }

  render() {
    if (this.allowed === null) {
      return html`
        <div class="ui fluid card">
          <div class="content">
            ${unsafeHTML(i18next.t('tracking_text'))}
          </div>
          <div class="content">
            <button class="ui button" @click="${() => this.saveResponse(true)}">
              ${i18next.t('tracking_agree_btn_label')}
              </button>
            <button class="ui button" @click="${() => this.saveResponse(false)}">
              ${i18next.t('tracking_deny_btn_label')}
            </button>
          </div>
        </div>
      `;
    }
  }

  saveResponse(allowed) {
    this.allowed = allowed;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-tracking-consent', NgmTrackingConsent);
