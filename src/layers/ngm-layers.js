import {html} from 'lit-element';
import {repeat} from 'lit-html/directives/repeat.js';
import Sortable from 'sortablejs';
import {LitElementI18n} from '../i18n.js';

import './ngm-layers-item.js';

export default class LayerTree extends LitElementI18n {

  static get properties() {
    return {
      actions: {type: Object},
      layers: {type: Object},
    };
  }

  firstUpdated() {
    new Sortable(this, {
      handle: '.grip',
      animation: 100,
      forceFallback: true,
      onEnd: (event) => {
        const oldIndex = this.layers.length - 1 - event.oldIndex;
        const newIndex = this.layers.length - 1 - event.newIndex;
        this.actions.moveLayer(this.layers, this.layers[oldIndex], newIndex - oldIndex);
        this.requestUpdate();
      }
    });
  }

  createRenderRoot() {
    return this;
  }

  /**
   *
   * @param {*} config
   * @param {number} idx
   */
  createLayerTemplate(config, idx, len) {
    idx = len - 1 - idx; // we want to create in reverse order

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
       label=${config.label}
       @removeDisplayedLayer=${() => this.dispatchEvent(new CustomEvent('removeDisplayedLayer', {detail}))}
       @zoomTo=${() => this.dispatchEvent(new CustomEvent('zoomTo', {detail: config}))}
       @layerChanged=${() => {
         this.dispatchEvent(new CustomEvent('layerChanged'));
         this.requestUpdate(); // force update to render visiblity changes
       }}
      >
    </ngm-layers-item>
    `;
  }

  // builds ui structure of layertree and makes render
  render() {
    const len = this.layers.length;
    const reverse = [...this.layers].reverse();
    return repeat(
      reverse,
      config => config.label,
      (config, idx) => this.createLayerTemplate(config, idx, len)
    );
  }
}

customElements.define('ngm-layers', LayerTree);
