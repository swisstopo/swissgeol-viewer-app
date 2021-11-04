import {LitElement, html} from 'lit';
import './ngm-layer-legend.js';

export class NgmLayerLegendContainer extends LitElement {

  constructor() {
    super();
    this.configs = new Set();
  }

  showLegend(config) {
    if (!this.configs.has(config)) {
      this.configs.add(config);
      this.requestUpdate();
    }
  }

  render() {
    return html`
      ${[...this.configs].map(config => html`
        <ngm-layer-legend .config=${config} @close=${this.onClose}></ngm-layer-legend>
      `)}
    `;
  }

  onClose(event) {
    console.assert(this.configs.has(event.target.config));
    this.configs.delete(event.target.config);
    this.requestUpdate();
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-layer-legend-container', NgmLayerLegendContainer);
