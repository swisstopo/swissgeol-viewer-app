import {html} from 'lit-element';
import {LitElementI18n} from '../i18n.js';
import i18next from 'i18next';
import auth from '../store/auth';


class Catalog extends LitElementI18n {

  constructor() {
    super();
    this.userGroups = null;
    auth.user.subscribe((user) => {
      this.userGroups = user ? user['cognito:groups'] : [];
    });
  }

  static get properties() {
    return {
      layers: {type: Object},
      userGroups: {type: Object},
    };
  }

  getCategoryOrLayerTemplate(c) {
    // if it is a restricted layer, the user must be logged in to see it
    if (c.restricted && (!this.userGroups || !this.userGroups.includes(c.restricted))) {
      return;
    }
    if (c.children) {
      return this.getCategoryTemplate(c);
    }
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
        <label class=${layer.displayed ? 'displayed' : ''}>
          <i class=${layer.restricted ? 'lock icon' : ''}></i>${i18next.t(layer.label)}
        </label>
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
