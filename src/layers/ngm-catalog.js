import {LitElement, html} from 'lit-element';
import {I18nMixin} from '../i18n.js';
import i18next from 'i18next';


class Catalog extends I18nMixin(LitElement) {

  static get properties() {
    return {
      layers: {type: Object},
    };
  }

  getCategoryOrLayerTemplate(c) {
    if (c.children)
      return this.getCategoryTemplate(c);
    return this.getLayerTemplate(c);
  }

  getCategoryTemplate(category) {
    return html`
    <div class="ui styled ngm-layers-categories accordion">
      <div class="title ngm-layer-title">
        <i class="dropdown icon"></i>
        ${i18next.t(category.label)}
      </div>
      <div class="content ngm-layer-content">
        ${category.children.map(c => this.getCategoryOrLayerTemplate(c))}
      </div>
    </div>`;
  }

  getLayerTemplate(layer) {
    return html`
      <div class="ui checkbox ngm-displayed-container" @click=${() => {
      this.dispatchEvent(new CustomEvent('layerclick', {
        detail: {
          layer
        }
      }));
    }}>
        <input
          class="ngm-layer-checkbox"
          type="checkbox"
          .checked=${layer.visible}>
        <label class=${layer.displayed ? 'displayed' : ''}>${i18next.t(layer.label)}</label>
      </div>`;
  }

  render() {
    if (!this.layers) return '';
    const templates = this.layers.map(l => this.getCategoryOrLayerTemplate(l));
    return html`${templates}`;
  }

  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-catalog', Catalog);
