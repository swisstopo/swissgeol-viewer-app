import i18next from 'i18next';
import {html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {createDataGenerator, createZipFromData} from '../download';
import {LitElementI18n} from '../i18n';
import {showSnackbarInfo} from '../notifications';
import {cartesianToDegrees} from '../projection';
import {coordinatesToBbox} from '../utils';
import {saveAs} from 'file-saver';

import type {CustomDataSource} from 'cesium';
import type {NgmGeometry} from './interfaces';
import type {Config} from '../layers/ngm-layers-item';


@customElement('data-download')
export class DataDownload extends LitElementI18n {
  @property({type: Object}) geometriesDataSource: CustomDataSource | undefined;
  @property({type: String}) selectedGeometryId = '';


  /**
   * Get configs of all displayed and downloadable layers.
   *
   * @returns {Config[]}
   */
  activeLayersForDownload(): Config[] {
    return (<any>document.getElementsByTagName('ngm-side-bar')[0]).activeLayers
      .filter((l: Config) => l.visible && (!!l.downloadDataType || l.downloadUrl));
  }


  async downloadData(config: Config, geom: NgmGeometry) {
    // Get bbox
    const rectangle = geom.positions.map(cartesianToDegrees);
    rectangle.pop();
    const bbox = coordinatesToBbox(rectangle);
    // Fetch data
    const data: any[] = [];
    const specs = [{
        layer: config.layer!,
        url: config.downloadDataPath!,
        type: config.downloadDataType!
      }];
    for await (const d of createDataGenerator(specs, bbox)) data.push(d);
    if (data.length === 0) {
      showSnackbarInfo(i18next.t('tbx_no_data_to_download_warning'));
      return;
    }
    // Zip data
    const zip = await createZipFromData(data);
    const blob = await zip.generateAsync({type: 'blob'});
    saveAs(blob, `${config.layer!}_${geom.name}.zip`.replace(/\s/g, '_'));
  }

  downloadOptionsTemplate(geom: NgmGeometry) {
    if (geom.id !== this.selectedGeometryId) {
      return html``;
    }

    const activeLayers = this.activeLayersForDownload();
    const content = activeLayers.length ? html`
      ${activeLayers.map((config: Config) => {
      return html`
        <div class="data-download-item">
          <div class="ngm-file-download-icon" @click=${() => {
            if (config.downloadDataType && config.downloadDataPath) {
              this.downloadData(config, geom);
            } else {
              window.open(config.downloadUrl);
            }
          }}></div>
          <label>${i18next.t(config.label)}</label>
        </div>
        `;
    })}
    ` : html`
      <div class="data-download-hint">
        ${i18next.t('tbx_data_download_hint')}
        <div class="ngm-info-icon"></div>
      </div>
    `;

    return html`
      <div class="data-download-options">
        ${content}
      </div>
    `;
  }

  render() {
    return html`
      <ngm-draw-section .enabledTypes=${['rectangle']} .showUpload=${false}></ngm-draw-section>
      <div class="ngm-divider"></div>
      <ngm-geometries-list
        .selectedId=${this.selectedGeometryId}
        .disabledTypes=${['point', 'polygon', 'line']}
        .optionsTemplate=${(geom: NgmGeometry) => this.downloadOptionsTemplate(geom)}
        @geomclick=${(evt: CustomEvent<NgmGeometry>) => {
        this.selectedGeometryId = this.selectedGeometryId !== evt.detail.id ? evt.detail.id! : '';
      }}
      ></ngm-geometries-list>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
