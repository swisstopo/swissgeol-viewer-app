import i18next from 'i18next';
import {html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {activeLayersForDownload, createDataGenerator, createZipFromData} from '../download';
import {LitElementI18n} from '../i18n';
import {showSnackbarInfo} from '../notifications';
import {cartesianToDegrees} from '../projection';
import {coordinatesToBbox} from '../utils';
import {saveAs} from 'file-saver';

import type {CustomDataSource} from 'cesium';
import type {NgmGeometry} from './interfaces';

@customElement('data-download')
export class DataDownload extends LitElementI18n {
  @property({type: Object}) geometriesDataSource: CustomDataSource | undefined;
  @property({type: String}) selectedId = '';


  async downloadActiveData(evt) {
    const {bbox4326} = evt.detail;
    const specs = activeLayersForDownload();
    const data: any[] = [];
    for await (const d of createDataGenerator(specs, bbox4326)) data.push(d);
    if (data.length === 0) {
      showSnackbarInfo(i18next.t('tbx_no_data_to_download_warning'));
      return;
    }
    const zip = await createZipFromData(data);
    const blob = await zip.generateAsync({type: 'blob'});
    saveAs(blob, 'swissgeol_data.zip');
  }

  downloadOptionsTemplate(options) {
    return html`
      <div class="data-download-options" ?hidden=${options.geom.id !== this.selectedId}>
        <button class="ui button ngm-download-obj-btn ngm-action-btn"
                ?hidden=${options.geom?.type !== 'rectangle' || !activeLayersForDownload().length}
                @click=${() => {
                  const rectangle = options.geom.positions.map(cartesianToDegrees);
                  rectangle.pop();
                  const bbox = coordinatesToBbox(rectangle);
                  this.downloadActiveData({
                    detail: {
                      bbox4326: bbox
                    }
                  });
                }
              }>
          ${i18next.t('tbx_download_selected')}
        </button>
      </div>
    `;
  }

  render() {
    return html`
      <ngm-geometries-list
        .selectedId=${this.selectedId}
        .disabledTypes=${['point', 'polygon', 'line']}
        .optionsTemplate=${(geom: NgmGeometry) => this.downloadOptionsTemplate({geom})}
        @geomclick=${(evt: CustomEvent<NgmGeometry>) => {
          this.selectedId = this.selectedId !== evt.detail.id ? evt.detail.id! : '';
          }}>
      </ngm-geometries-list>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
