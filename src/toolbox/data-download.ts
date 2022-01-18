import {CustomDataSource} from 'cesium';
import {html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n';
import {NgmGeometry} from './interfaces';


@customElement('data-download')
export class DataDownload extends LitElementI18n {
  @property({type: Object}) geometriesDataSource: CustomDataSource | undefined;
  @state() selectedId: string = '';

  downloadOptionsTemplate(options) {

    return html`
      <div class="data-download-options" ?hidden=${options.geom.id !== this.selectedId}>
          Data download options
      </div>
    `
  }

  render() {
    return html`
      <ngm-geometries-list
        .selectedId=${this.selectedId}
        .disabledTypes=${['point', 'polygon', 'line']}
        .optionsTemplate=${(geom) => this.downloadOptionsTemplate({geom})}
        @geomclick=${(evt: CustomEvent<NgmGeometry>) => {
          this.selectedId = this.selectedId !== evt.detail.id ? evt.detail.id! : ''
          }}>
      </ngm-geometries-list>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
