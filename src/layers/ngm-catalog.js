import {LitElement, html} from 'lit-element';
import {onAccordionClick} from '../utils.js';
import {I18nMixin} from '../i18n.js';
import i18next from 'i18next';


class Catalog extends I18nMixin(LitElement) {

  static get properties() {
    return {
      layers: {type: Object},
      onclick: {type: Function},
    };
  }

  getCategoryOrLayerTemplate(c) {
    if (c.children)
      return this.getCategoryTemplate(c);
    return this.getLayerTemplate(c);
  }

  getCategoryTemplate(category) {
    return html`
    <div class="ui styled accordion">
      <div class="title ngm-layer-title" @click=${onAccordionClick}>
        <i class="dropdown icon"></i>
        ${i18next.t(category.label)}
      </div>
      <div class="content ngm-layer-content">
        <div>
        ${category.children.map(c => this.getCategoryOrLayerTemplate(c))}
        </div>
      </div>
    </div>`;
  }

  getLayerTemplate(layer) {
    return html`
      <div class="ui checkbox" @click=${() => {
        layer.displayed = !layer.displayed;
        layer.visible = layer.displayed;
        this.onclick(layer);
      }}>
        <input
          class="ngm-layer-checkbox"
          type="checkbox"
          .checked=${layer.displayed}>
        <label>${i18next.t(layer.label)}</label>
      </div>`;
  }

  render() {
    const templates = this.layers.map(l => this.getCategoryOrLayerTemplate(l));
    return html`${templates}`;
  }

  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-catalog', Catalog);
