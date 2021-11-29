import {html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import draggable from './draggable';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import {Interactable} from '@interactjs/types';
import {Config} from '../layers/ngm-layers-item';

@customElement('ngm-layer-legend')
export class NgmLayerLegend extends LitElementI18n {
  @state() config!: Config;
  @state() interaction: Interactable | null = null;

  connectedCallback() {
    this.interaction = draggable(this, {
      allowFrom: '.drag-handle'
    });
    super.connectedCallback();
  }

  render() {
    const legendImage = this.config.legend ? `https://api.geo.admin.ch/static/images/legends/${this.config.legend}_${i18next.language}.png` : undefined;
    const geocatUrl = this.config.geocatId ? geocatLink(this.config.geocatId) : undefined;
    return html`
      <div class="ngm-floating-window-header drag-handle">
      ${i18next.t(this.config.label)}
        <div class="ngm-close-icon" @click=${() => this.dispatchEvent(new CustomEvent('close'))}></div>
      </div>
      <div class="content-container">
          ${legendImage ? html`<div><img src="${legendImage}"></div>` : ''}
          ${geocatUrl ? html`<div><a target="_blank" href="${geocatUrl}">${i18next.t('dtd_geocat_link')}</a></div>` : ''}
      </div>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

const GEOCAT_LANG_CODE = {
  'de': 'ger',
  'fr': 'fre',
  'it': 'ita',
  'en': 'eng',
};

function geocatLink(id: string) {
  const lang = GEOCAT_LANG_CODE[i18next.language];
  return `https://www.geocat.ch/geonetwork/srv/${lang}/md.viewer#/full_view/${id}/tab/complete`;
}
