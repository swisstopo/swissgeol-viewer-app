import {LitElement} from 'lit-element';
import './ngm-layer-legend.js';

class NgmLayerLegendContainer extends LitElement {

  showLegend(config) {
    console.assert(config.layer);
    const legendId = `legend_for_${config.layer}`;
    if (!this.querySelector('#' + legendId)) {
      const element = document.createElement('ngm-layer-legend');
      element.id = legendId;
      element.config = config;
      element.addEventListener('close', event => event.target.remove());
      this.appendChild(element);
    }
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-layer-legend-container', NgmLayerLegendContainer);
