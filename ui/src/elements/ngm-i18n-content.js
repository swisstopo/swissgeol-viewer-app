import { html } from 'lit';
import i18next from 'i18next';
import { LitElementI18n } from '../i18n.js';

class NgmI18nDiv extends LitElementI18n {
  static get properties() {
    return {
      key: { type: String },
    };
  }

  render() {
    return html`${i18next.t(this.key)}`;
  }
}

customElements.define('ngm-i18n-content', NgmI18nDiv);
