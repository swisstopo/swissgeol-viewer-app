import {html, LitElement} from 'lit-element';
import {repeat} from 'lit-html/directives/repeat.js';

import {I18nMixin} from '../i18n.js';

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

  /**
   *
   * @param {*} config
   * @param {number} idx
   */
  createLayerTemplate(config, idx, len) {
    const upClassMap = {disabled: (idx === 0)};
    idx = len - 1 - idx; // we want to create in reverse order
    const downClassMap = {disabled: idx === 0};

    if (!config.promise) {
      config.promise = config.load();
    }
    const detail = {
      config,
      idx
    };
    return html`
    <ngm-layers-item
       .actions=${this.actions}
       .config=${config}
       label=${config.label}
       @removeDisplayedLayer=${() => this.dispatchEvent(new CustomEvent('removeDisplayedLayer', {detail}))}
       @zoomTo=${() => this.dispatchEvent(new CustomEvent('zoomTo', {detail: config}))}
       @layerChanged=${() => {
         this.dispatchEvent(new CustomEvent('layerChanged'));
         this.requestUpdate(); // force update to render visiblity changes
       }}
       @moveLayer=${evt => this.moveLayer(config, evt.detail)}
       .upClassMap=${upClassMap}
       .downClassMap=${downClassMap}
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

  // changes layer position in 'Displayed Layers'
  moveLayer(config, delta) {
    this.actions.moveLayer(this.layers, config, delta);
    this.requestUpdate();
  }
}

customElements.define('ngm-layers', LayerTree);
