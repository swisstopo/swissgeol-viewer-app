import {customElement, html, property} from 'lit-element';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import $ from '../jquery';
import {lv95ToDegrees} from '../projection';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Cartographic from 'cesium/Source/Core/Cartographic';
import {prepareCoordinatesForUi} from '../cesiumutils';
import CesiumMath from 'cesium/Source/Core/Math';

import {AOI_COLORS, AOI_POINT_SYMBOLS} from '../constants';
import {updateBoreholeHeights} from './helpers';
import JulianDate from 'cesium/Source/Core/JulianDate';
import MainStore from '../store/main';
import {Entity, Viewer} from 'cesium';

@customElement('ngm-point-edit')
export class NgmPointEdit extends LitElementI18n {
  @property({type: Object}) position: Cartesian3 | undefined
  @property({type: Object}) entity: Entity | undefined
  @property({type: Number}) depth = 0
  @property({type: Boolean}) volumeShowed = false
  @property({type: Boolean}) restricted = false
  xValue = 0;
  yValue = 0;
  heightValue = 0;
  coordsStep = 0.001;
  coordsType: 'lv95' | 'wsg84' = 'wsg84';
  minHeight = -30000;
  maxHeight = 30000;
  minDepth = -30000;
  maxDepth = 30000;
  private julianDate: JulianDate = new JulianDate();
  private viewer: Viewer | null = null;
  private dropdownInited = false;

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
  }

  updated() {
    if (this.position && !this.dropdownInited) {
      $(this.querySelector('.ngm-coord-type-select')).dropdown({
        onChange: value => {
          this.coordsType = value;
          this.coordsStep = value === 'lv95' ? 100 : 0.001;
          this.updateInputValues();
          this.requestUpdate();
        },
        values: [
          {
            name: 'LV95',
            value: 'lv95',
            selected: this.coordsType === 'lv95'
          },
          {
            name: 'WSG84',
            value: 'wsg84',
            selected: this.coordsType === 'wsg84'
          }
        ]
      });
      this.dropdownInited = true;
    }
  }

  updateInputValues() {
    const cartographicPosition = Cartographic.fromCartesian(this.position!);
    const coordinates = prepareCoordinatesForUi(this.viewer!.scene, cartographicPosition, this.coordsType);
    this.xValue = coordinates.x;
    this.yValue = coordinates.y;
    this.heightValue = coordinates.height;
  }

  onPositionChange() {
    if (this.restricted || !this.entity) return;
    this.xValue = Number((<HTMLInputElement> this.querySelector('.ngm-coord-x-input'))!.value);
    this.yValue = Number((<HTMLInputElement> this.querySelector('.ngm-coord-y-input'))!.value);
    const heightValue = Number((<HTMLInputElement> this.querySelector('.ngm-height-input'))!.value);
    this.heightValue = CesiumMath.clamp(heightValue, this.minHeight, this.maxHeight);
    let lon = this.xValue;
    let lat = this.yValue;
    if (this.coordsType === 'lv95') {
      const radianCoords = lv95ToDegrees([this.xValue, this.yValue]);
      lon = radianCoords[0];
      lat = radianCoords[1];
    }
    const height = this.heightValue;
    const cartesianPosition = Cartesian3.fromDegrees(lon, lat, height);
    this.position = cartesianPosition;
    this.updateInputValues();
    this.entity.position = <any>cartesianPosition;
    updateBoreholeHeights(this.entity, this.julianDate);
    this.viewer!.scene.requestRender();
  }

  onDepthChange(event) {
    if (this.restricted || !this.entity) return;
    const depth = Number(event.target.value);
    this.depth = depth;
    this.entity.properties!.depth = depth;
    updateBoreholeHeights(this.entity, this.julianDate);
  }

  onColorChange(color) {
    if (!this.entity || !this.entity.billboard) return;
    this.entity.billboard.color = color;
  }

  onSymbolChange(image) {
    if (!this.entity || !this.entity.billboard) return;
    this.entity.billboard.image = <any>`./images/${image}`;
  }

  render() {
    if (this.position) {
      this.updateInputValues();
    }
    return html`
      <div>
        <label>${i18next.t('nav_coordinates_label')}:</label>
        <div class="ngm-coord-input">
          <div class="ui mini right labeled input">
            <div class="ui mini dropdown label ngm-coord-type-select">
              <div class="text"></div>
              <i class="dropdown icon"></i>
            </div>
            <input type="number" class="ngm-coord-x-input" ?disabled="${this.restricted}"
                   .step="${this.coordsStep}"
                   .value="${this.xValue}"
                   @change="${this.onPositionChange}">
          </div>
          <div class="ui mini left action input">
            <input type="number" class="ngm-coord-y-input" ?disabled="${this.restricted}"
                   .step="${this.coordsStep}"
                   .value="${this.yValue}"
                   @change="${this.onPositionChange}">
          </div>
        </div>
        <label>${i18next.t('tbx_camera_height_label')}:</label></br>
        <div class="ui mini input right labeled">
          <input type="number" step="10" min="${this.minHeight}" max="${this.maxHeight}" ?disabled="${this.restricted}"
                 class="ngm-height-input" .value="${this.heightValue}" @change="${this.onPositionChange}">
          <label class="ui label">m</label>
        </div>

        <ngm-geom-configuration
          .iconClass= ${'map marker alternate'}
          .colors="${AOI_COLORS}"
          .symbols="${AOI_POINT_SYMBOLS}"
          .onColorChange="${color => this.onColorChange(color)}"
          .onSymbolChange="${symbol => this.onSymbolChange(symbol)}"
        ></ngm-geom-configuration>

        <div ?hidden="${!this.volumeShowed}">
          <label>${i18next.t('tbx_point_depth_label')}:</label></br>
          <div class="ui mini input right labeled">
            <input type="number" step="10" min="${this.minDepth}" max="${this.maxDepth}" ?disabled="${this.restricted}"
                   class="ngm-point-depth-input" .value="${this.depth}" @change="${this.onDepthChange}">
            <label class="ui label">m</label>
          </div>
        </div>
      </div>

    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
