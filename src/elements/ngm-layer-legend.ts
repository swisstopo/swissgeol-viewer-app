import {html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import draggable from './draggable';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import {Config} from '../layers/ngm-layers-item';

@customElement('ngm-layer-legend')
export class NgmLayerLegend extends LitElementI18n {
  @state() config!: Config;

  protected firstUpdated(_changedProperties) {
    // hidden is required to have correct window placing
    this.hidden = true;
    draggable(this, {
      allowFrom: '.drag-handle'
    });
    this.hidden = false;
    super.firstUpdated(_changedProperties);
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
        <table class="ui compact small very basic table">
          <tbody>
          ${legendImage ? html`
            <tr class="top aligned">
              <td class="key">${i18next.t('dtd_legend')}</td>
              <td class="value"><img src="${legendImage}"></td>
            </tr>
            ` : ''}
          ${geocatUrl ? html`
          <tr class="top aligned">
            <td class="key">${i18next.t('dtd_geocat_link')}</td>
            <td class="value"><a href="${geocatUrl}" target="_blank" rel="noopener">${i18next.t('link')}</a></td>
          </tr>
          ` : ''}
          </tbody>
        </table>
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
