import {LitElementI18n} from '../i18n';
import {html} from 'lit';
import i18next from 'i18next';

class NgmSymbolSelector extends LitElementI18n {
  static get properties() {
    return {
      onSymbolChange: {type: Function},
      symbols: {type: Array}
    };
  }

  render() {
    return html`
      <label>${i18next.t('tbx_symbol_label')}</label>
      <div class="ngm-aoi-symbol-selector">
        ${this.symbols.map(image =>
          html`<img
            class="ui mini image"
            src="./images/${image}"
            @click=${this.onSymbolChange.bind(this, image)}>`
        )}
      </div>`;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-symbol-selector', NgmSymbolSelector);
