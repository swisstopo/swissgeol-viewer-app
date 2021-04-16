import {LitElementI18n} from '../i18n';
import {html} from 'lit-element';
import i18next from 'i18next';

class NgmColorpicker extends LitElementI18n {
  static get properties() {
    return {
      onColorChange: {type: Function},
      colors: {type: Array}
    };
  }

  render() {
    return html`
      <label>${i18next.t('tbx_color_label')}</label>
      <div class="ngm-aoi-color-selector">
        ${this.colors.map(color =>
          html`
            <div
              style="background-color: ${color.color};"
              @click=${this.onColorChange.bind(this, color.value)}
              class="ngm-aoi-color-container"></div>`
        )}
      </div>`;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-colorpicker', NgmColorpicker);
