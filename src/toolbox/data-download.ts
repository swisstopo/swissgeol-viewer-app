import {CustomDataSource} from 'cesium';
import {html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n';


@customElement('data-download')
export class DataDownload extends LitElementI18n {
  @property({type: Object}) geometriesDataSource: CustomDataSource | undefined;
  sliceGeomId: unknown;


  render() {
    return html`
      <ngm-geometries-list
        .selectedId=${this.sliceGeomId}
        .disabledTypes=${['point', 'polygon', 'line']}>
      </ngm-geometries-list>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
