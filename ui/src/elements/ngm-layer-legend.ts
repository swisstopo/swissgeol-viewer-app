import { html, PropertyValues } from 'lit';
import { until } from 'lit/directives/until.js';
import { customElement, state } from 'lit/decorators.js';
import draggable from './draggable';
import i18next from 'i18next';
import { LitElementI18n } from '../i18n.js';

import { LayerConfig, LayerType } from '../layertree';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { classMap } from 'lit/directives/class-map.js';
import { dragArea } from './helperElements';

@customElement('ngm-layer-legend')
export class NgmLayerLegend extends LitElementI18n {
  @state()
  accessor config!: LayerConfig;

  protected firstUpdated(_changedProperties: PropertyValues) {
    // hidden is required to have correct window placing
    this.hidden = true;
    draggable(this, {
      allowFrom: '.drag-handle',
    });
    this.hidden = false;
    super.firstUpdated(_changedProperties);
  }

  getImageLegend() {
    const legendImage = this.config.legend
      ? `https://api.geo.admin.ch/static/images/legends/${this.config.legend}_${i18next.language}.png`
      : undefined;
    return (
      legendImage &&
      html` <div class="ngm-legend-container">
        <div>${i18next.t('dtd_legend')}</div>
        <div class="ngm-legend-image"><img src="${legendImage}" /></div>
      </div>`
    );
  }

  async getWmtsLegend() {
    const response = await fetch(
      `https://api3.geo.admin.ch/rest/services/api/MapServer/${this.config.layer}/legend?lang=${i18next.language}`,
    );
    const legendHtml = await response.text();
    return html` <div class="ngm-legend-html">${unsafeHTML(legendHtml)}</div>`;
  }

  render() {
    return html`
      <div class="ngm-floating-window-header drag-handle">
        ${i18next.t(this.config.label)}
        <div
          class="ngm-close-icon"
          @click=${() => this.dispatchEvent(new CustomEvent('close'))}
        ></div>
      </div>
      <div
        class="content-container ${classMap({
          'legend-html': this.config.type === LayerType.swisstopoWMTS,
        })}"
      >
        ${this.config.type === LayerType.swisstopoWMTS
          ? until(this.getWmtsLegend(), html` <div class="ui loader"></div>`)
          : this.getImageLegend()}
      </div>
      ${dragArea}
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
