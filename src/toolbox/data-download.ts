import i18next from 'i18next';
import {html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {activeLayersForDownload, createDataGenerator, createZipFromData} from '../download';
import {LitElementI18n} from '../i18n';
import {showSnackbarInfo} from '../notifications';
import {cartesianToDegrees} from '../projection';
import {coordinatesToBbox} from '../utils';
import {saveAs} from 'file-saver';
import {classMap} from 'lit-html/directives/class-map.js';

import type {CustomDataSource} from 'cesium';
import type {NgmGeometry} from './interfaces';
import type {Config} from '../layers/ngm-layers-item';


@customElement('data-download')
export class DataDownload extends LitElementI18n {
  @property({type: Object}) geometriesDataSource: CustomDataSource | undefined;
  @property({type: String}) selectedGeometryId = '';
  selectedLayers: Map<string, Set<string>> = new Map;


  async downloadSelectedData(geom: NgmGeometry) {
    // Get bbox
    const rectangle = geom.positions.map(cartesianToDegrees);
    rectangle.pop();
    const bbox = coordinatesToBbox(rectangle);
    // Get selected layers
    const selectedLayers = this.selectedLayers.get(geom.id!)!;
    const specs = activeLayersForDownload().filter(l => selectedLayers.has(l.layer!)).map(l => ({
      layer: l.layer,
      url: l.downloadDataPath,
      type: l.downloadDataType
    }));
    // Fetch data
    const data: any[] = [];
    for await (const d of createDataGenerator(specs, bbox)) data.push(d);
    if (data.length === 0) {
      showSnackbarInfo(i18next.t('tbx_no_data_to_download_warning'));
      return;
    }
    // Zip data
    const zip = await createZipFromData(data);
    const blob = await zip.generateAsync({type: 'blob'});
    saveAs(blob, 'swissgeol_data.zip');
  }

  downloadOptionsTemplate(geom: NgmGeometry) {
    if (geom.id !== this.selectedGeometryId) {
      return html``;
    }

    const activeLayers = activeLayersForDownload();

    if (!this.selectedLayers.has(geom.id!)) {
      this.selectedLayers.set(geom.id!, new Set);
    }

    const content = activeLayers.length ? html`
      ${activeLayers.map((config: Config) => {
        const selectedLayers = this.selectedLayers.get(geom.id!)!;
        return html`
        <div class="ngm-checkbox ${classMap({active: selectedLayers.has(config.layer!)})}"
             @click=${() => {
                selectedLayers.has(config.layer!) ? selectedLayers.delete(config.layer!) : selectedLayers.add(config.layer!);
                this.requestUpdate();
              }}>
          <input type="checkbox" .checked=${selectedLayers.has(config.layer!)}>
          <span class="ngm-checkbox-icon"></span>
          <label>${i18next.t(config.label)}</label>
        </div>
      `;})}
      <button class="ui button ngm-action-btn"
              @click=${() => this.downloadSelectedData(geom)}
        >${i18next.t('tbx_download_selected')}</button>
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
