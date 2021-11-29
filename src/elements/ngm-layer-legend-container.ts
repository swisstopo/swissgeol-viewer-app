import {LitElement, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {Config} from '../layers/ngm-layers-item';
import './ngm-layer-legend';

@customElement('ngm-layer-legend-container')
export class NgmLayerLegendContainer extends LitElement {
  @state() configs: Set<Config> = new Set();

  showLegend(config: Config) {
    if (!this.configs.has(config)) {
      this.configs.add(config);
      this.requestUpdate();
    }
  }

  onClose(event) {
    console.assert(this.configs.has(event.target.config));
    this.configs.delete(event.target.config);
    this.requestUpdate();
  }

  render() {
    return html`
      ${[...this.configs].map(config => html`
        <ngm-layer-legend class="ngm-floating-window" .config=${config} @close=${this.onClose}></ngm-layer-legend>
      `)}
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
