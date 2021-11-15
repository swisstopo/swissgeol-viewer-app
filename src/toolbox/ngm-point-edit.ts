import {html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Cartographic from 'cesium/Source/Core/Cartographic';
import {getValueOrUndefined, prepareCoordinatesForUi} from '../cesiumutils';
import CesiumMath from 'cesium/Source/Core/Math';
import {updateBoreholeHeights} from './helpers';
import JulianDate from 'cesium/Source/Core/JulianDate';
import MainStore from '../store/main';
import {Entity, Viewer} from 'cesium';

@customElement('ngm-point-edit')
export class NgmPointEdit extends LitElementI18n {
  @property({type: Object}) entity: Entity | undefined;
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

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
  }

  updateInputValues() {
    if (!this.entity || !this.entity.position) return;
    const cartographicPosition = Cartographic.fromCartesian(this.entity.position.getValue(this.julianDate));
    const coordinates = prepareCoordinatesForUi(this.viewer!.scene, cartographicPosition, this.coordsType);
    this.xValue = coordinates.x;
    this.yValue = coordinates.y;
    this.heightValue = coordinates.height;
  }

  onPositionChange() {
    if (!this.entity) return;
    this.xValue = Number((<HTMLInputElement> this.querySelector('.ngm-coord-x-input'))!.value);
    this.yValue = Number((<HTMLInputElement> this.querySelector('.ngm-coord-y-input'))!.value);
    const heightValue = Number((<HTMLInputElement> this.querySelector('.ngm-height-input'))!.value);
    this.heightValue = CesiumMath.clamp(heightValue, this.minHeight, this.maxHeight);
    const lon = this.xValue;
    const lat = this.yValue;
    const height = this.heightValue;
    const cartesianPosition = Cartesian3.fromDegrees(lon, lat, height);
    this.entity.position = <any>cartesianPosition;
    this.updateInputValues();
    updateBoreholeHeights(this.entity, this.julianDate);
    this.viewer!.scene.requestRender();
  }

  onDepthChange(event) {
    if (!this.entity) return;
    this.entity.properties!.depth = Number(event.target.value);
    updateBoreholeHeights(this.entity, this.julianDate);
  }

  render() {
    if (this.entity) {
      this.updateInputValues();
    }
    return html`
      <div class="ngm-geom-edit-double-input">
        <div class="ngm-input">
          <input class="ngm-coord-x-input" step=${this.coordsStep} type="number" .value=${this.xValue}
                 @change="${this.onPositionChange}"
                 required/>
          <span class="ngm-floating-label">${i18next.t('tbx_lon_label')}</span>
        </div>
        <div class="ngm-input">
          <input class="ngm-coord-y-input" step=${this.coordsStep} type="number" .value=${this.yValue}
                 @change="${this.onPositionChange}"
                 required/>
          <span class="ngm-floating-label">${i18next.t('tbx_lat_label')}</span>
        </div>
      </div>
      <div class="ngm-geom-edit-double-input">
        <div class="ngm-input">
          <input class="ngm-height-input" type="number" .value=${this.heightValue} @change="${this.onPositionChange}"
                 required/>
          <span class="ngm-floating-label">${i18next.t('tbx_volume_height_label')}</span>
        </div>
        <div class="ngm-input" ?hidden=${!getValueOrUndefined(this.entity?.properties!.volumeShowed)}>
          <input type="number" .value=${getValueOrUndefined(this.entity?.properties!.depth)}
                 @change="${this.onDepthChange}" required/>
          <span class="ngm-floating-label">${i18next.t('tbx_point_depth_label')}</span>
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
