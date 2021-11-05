import {html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n';
import './ngm-aoi-drawer';
import './ngm-slicer';
import './ngm-geometries-list';
import i18next from 'i18next';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import {AOI_DATASOURCE_NAME} from '../constants';
import MainStore from '../store/main';
import {JulianDate, Viewer} from 'cesium';
import LocalStorageController from '../LocalStorageController';
import ToolboxStore from '../store/toolbox';
import {getValueOrUndefined} from '../cesiumutils';
import {NgmGeometry} from './interfaces';
import {getAreaPositions} from './helpers';
import {getSliceParam} from '../permalink';

@customElement('ngm-tools')
export class NgmToolbox extends LitElementI18n {
  @property({type: Boolean}) toolsHidden = true;
  @state() activeTool: 'draw' | 'slicing' | undefined;
  geometriesDataSource: CustomDataSource = new CustomDataSource(AOI_DATASOURCE_NAME);
  private viewer: Viewer | null = null;
  private julianDate = new JulianDate();

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => {
      this.viewer = viewer;
      this.viewer?.dataSources.add(this.geometriesDataSource);
      this.geometriesDataSource!.entities.collectionChanged.addEventListener((_collection) => {
        this.viewer!.scene.requestRender();
        this.requestUpdate();
        LocalStorageController.setAoiInStorage(this.entitiesList);
        ToolboxStore.setGeometries(this.entitiesList);
      });
    });
  }

  firstUpdated() {
    const sliceOptions = getSliceParam();
    if (sliceOptions && sliceOptions.type && sliceOptions.slicePoints)
      this.activeTool = 'slicing';
  }

  private get entitiesList(): NgmGeometry[] {
    return this.geometriesDataSource!.entities.values.map(val => {
      const item = {
        id: val.id,
        name: val.name,
        show: val.isShowing,
        positions: getAreaPositions(val, this.julianDate),
        area: getValueOrUndefined(val.properties!.area),
        perimeter: getValueOrUndefined(val.properties!.perimeter),
        sidesLength: getValueOrUndefined(val.properties!.sidesLength),
        numberOfSegments: getValueOrUndefined(val.properties!.numberOfSegments),
        type: getValueOrUndefined(val.properties!.type),
        volumeShowed: getValueOrUndefined(val.properties!.volumeShowed),
        volumeHeightLimits: getValueOrUndefined(val.properties!.volumeHeightLimits),
        description: getValueOrUndefined(val.properties!.description),
        image: getValueOrUndefined(val.properties!.image),
        website: getValueOrUndefined(val.properties!.website),
        swissforagesId: getValueOrUndefined(val.properties!.swissforagesId),
        depth: getValueOrUndefined(val.properties!.depth),
        showSlicingBox: getValueOrUndefined(val.properties!.showSlicingBox),
        color: undefined,
        pointSymbol: undefined
      };
      if (val.billboard) {
        item.color = val.billboard.color!.getValue(this.julianDate);
        item.pointSymbol = val.billboard.image!.getValue(this.julianDate);
      } else if (val.polyline) {
        item.color = val.properties!.colorBeforeHighlight || val.polyline.material.getValue(this.julianDate).color;
      } else if (val.polygon) {
        item.color = val.properties!.colorBeforeHighlight || val.polygon.material.getValue(this.julianDate).color;
      }
      return item;
    });
  }

  render() {
    return html`
      <div class="ngm-panel-header">
        <div ?hidden=${!this.activeTool} class="ngm-back-icon" @click=${() => this.activeTool = undefined}></div>
        ${i18next.t(this.activeTool ? `tbx_${this.activeTool}` : 'lsb_tools')}
        <div class="ngm-close-icon" @click=${() => this.dispatchEvent(new CustomEvent('close'))}></div>
      </div>
      <div class="ngm-tools-list" .hidden="${this.activeTool}">
        <div class="ngm-tools-list-item" @click=${() => this.activeTool = 'draw'}>
          <div class="ngm-vector-icon"></div>
          <div>${i18next.t('tbx_draw')}</div>
        </div>
        <div class="ngm-tools-list-item" @click=${() => this.activeTool = 'slicing'}>
          <div class="ngm-slicing-icon"></div>
          <div>${i18next.t('tbx_slicing')}</div>
        </div>
      </div>
      <ngm-aoi-drawer .hidden="${this.activeTool !== 'draw'}"
                      .geometriesDataSource=${this.geometriesDataSource}></ngm-aoi-drawer>
      <ngm-slicer .hidden=${this.activeTool !== 'slicing'}
                  .slicerHidden="${this.activeTool !== 'slicing' || this.toolsHidden}"
                  .geometriesDataSource=${this.geometriesDataSource}></ngm-slicer>`;
  }

  createRenderRoot() {
    return this;
  }

}
