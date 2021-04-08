import {LitElementI18n} from '../i18n';
import {html} from 'lit-element';
import $ from '../jquery';
import '../elements/ngm-colorpicker.js';
import '../elements/ngm-symbol-selector.js';

class NgmGeomConfiguration extends LitElementI18n {
  static get properties() {
    return {
      onSymbolChange: {type: Function},
      symbols: {type: Array},
      onColorChange: {type: Function},
      colors: {type: Array},
      iconClass: {type: String}
    };
  }

  updated() {
    if (!this.popupInited) {
      $(this.querySelector('.ngm-style-btn')).popup({
        popup: $(this.querySelector('.ngm-geom-style-popup')),
        on: 'click',
        position: 'right center'
      });
      this.popupInited = true;
    }
  }

  render() {
    return html`
      <button class="ui icon button ngm-style-btn">
        <i class="${this.iconClass} icon"></i>
      </button>
      <div class="ui mini popup ngm-geom-style-popup">
        <ngm-colorpicker .colors="${this.colors}"
                         .onColorChange=${(color) => this.onColorChange(color)}>

        </ngm-colorpicker>
        ${this.symbols && this.symbols.length ?
          html`
            <ngm-symbol-selector .symbols="${this.symbols}"
                                 .onSymbolChange=${(symbol) => this.onSymbolChange(symbol)}>

            </ngm-symbol-selector>
          ` : ''
        }
      </div>`;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-geom-configuration', NgmGeomConfiguration);
