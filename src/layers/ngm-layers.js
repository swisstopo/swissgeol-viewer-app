import {html, LitElement} from 'lit-element';
import {I18nMixin} from '../i18n.js';
import Sortable from 'sortablejs';

import './ngm-layers-item.js';

export default class LayerTree extends I18nMixin(LitElement) {

  static get properties() {
    return {
      actions: {type: Object},
      layers: {type: Object},
    };
  }

  createRenderRoot() {
    return this;
  }

  // builds ui structure of layertree and makes render
  render() {
    const layerTemplates = this.layers.map((config, idx) => {
      if (!config.promise) {
        config.promise = config.load();
      }
      const detail = {
        config,
        idx
      };
      return html`
      <ngm-layers-item
        class="item"
         .actions=${this.actions}
         .config=${config}
         @removeDisplayedLayer=${() => this.dispatchEvent(new CustomEvent('removeDisplayedLayer', {detail}))}
         @zoomTo=${() => this.dispatchEvent(new CustomEvent('zoomTo', {detail: config}))}
         @layerChanged=${() => {
           this.dispatchEvent(new CustomEvent('layerChanged'));
           this.requestUpdate(); // force update to render visiblity changes
         }}
        >
      </ngm-layers-item>`;
    });
    layerTemplates.reverse();

    return html`${layerTemplates}`;
  }

  firstUpdated() {
    new Sortable(this, {
      handle: '.grip',
      animation: 100,
      forceFallback: false,
      onEnd: (event) => {
        const oldIndex = this.layers.length - 1 - event.oldIndex;
        const newIndex = this.layers.length - 1 - event.newIndex;
        this.actions.moveLayer(this.layers, this.layers[oldIndex], newIndex - oldIndex);
        this.requestUpdate();
      }
    });
  }
}

customElements.define('ngm-layers', LayerTree);
