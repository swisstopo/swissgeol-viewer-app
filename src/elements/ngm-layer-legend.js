import {html} from 'lit';
import draggable from './draggable.ts';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';

class NgmLayerLegend extends LitElementI18n {

  static get properties() {
    return {
      config: {type: Object},
    };
  }

  constructor() {
    super();
    this.config = {};
  }

  connectedCallback() {
    draggable(this, {
      allowFrom: '.header'
    });
    super.connectedCallback();
  }

  close() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  render() {
    const legendImage = this.config.legend ? `https://api.geo.admin.ch/static/images/legends/${this.config.legend}_${i18next.language}.png` : undefined;
    const geocatUrl = this.config.geocatId ? geocatLink(this.config.geocatId) : undefined;
    return html`
      <div class="ui segment">
        <div class="header">
          <div class="title">${i18next.t(this.config.label)}</div>
          <div style="flex: auto"></div>
          <a href="#"><i @click="${this.close}" class="times icon"></i></a>
        </div>
        <div class="ui divider"></div>
        <div class="content-container">
          ${legendImage ? html`<div><img src="${legendImage}"></div>` : ''}
          ${geocatUrl ? html`<div><a target="_blank" href="${geocatUrl}">${i18next.t('dtd_disclaimer_hint')}</a></div>` : ''}
        </div>
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

function geocatLink(id) {
  const lang = GEOCAT_LANG_CODE[i18next.language];
  return `https://www.geocat.ch/geonetwork/srv/${lang}/md.viewer#/full_view/${id}/tab/complete`;
}

customElements.define('ngm-layer-legend', NgmLayerLegend);
