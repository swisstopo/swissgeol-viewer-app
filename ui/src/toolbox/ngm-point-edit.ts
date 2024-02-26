import type {PropertyValues} from 'lit';
import {html} from 'lit';
import {customElement, property, query, state} from 'lit/decorators.js';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import {Cartesian3, JulianDate, Math as CesiumMath} from 'cesium';
import {getValueOrUndefined} from '../geoblocks/cesium-helpers/cesiumutils';
import {updateBoreholeHeights} from './helpers';
import MainStore from '../store/main';
import type {Entity, Viewer} from 'cesium';
import {cartesianToDegrees, cartesianToLv95, lv95ToDegrees} from '../projection';
import 'fomantic-ui-css/components/transition.js';
import 'fomantic-ui-css/components/dropdown.js';
import $ from '../jquery.js';
import {styleMap} from 'lit/directives/style-map.js';

@customElement('ngm-point-edit')
export class NgmPointEdit extends LitElementI18n {
  @property({type: Object})
  accessor entity: Entity | undefined;
  xValue = 0;
  yValue = 0;
  heightValue = 0;
  @state()
  accessor coordsType: 'lv95' | 'wgs84' = 'lv95';
  minHeight = -30000;
  maxHeight = 30000;
  minDepth = -30000;
  maxDepth = 30000;
  private julianDate: JulianDate = new JulianDate();
  private viewer: Viewer | null = null;

  @query('.dropdown')
  accessor dropdown;

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
  }

  updated(changedProperties: PropertyValues) {
    $(this.dropdown).dropdown();
    super.updated(changedProperties);
  }

  updateInputValues() {
    if (this.entity && this.entity.position) {
      const position = this.entity.position.getValue(this.julianDate);
      if (this.coordsType === 'lv95') {
        const coords = cartesianToLv95(position!);
        this.xValue = Number(coords[0].toFixed(1));
        this.yValue = Number(coords[1].toFixed(1));
        this.heightValue = Number(coords[2].toFixed(1));
      } else {
        const coords = cartesianToDegrees(position!);
        this.xValue = Number(coords[0].toFixed(3));
        this.yValue = Number(coords[1].toFixed(3));
        this.heightValue = Number(coords[2].toFixed(1));
      }
    }
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
    let cartesianPosition: Cartesian3;
    if (this.coordsType === 'lv95') {
      const degreesPosition = lv95ToDegrees([lon, lat]);
      cartesianPosition = Cartesian3.fromDegrees(degreesPosition[0], degreesPosition[1], height);
    } else {
      cartesianPosition = Cartesian3.fromDegrees(lon, lat, height);
    }
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
      <div class="ngm-point-edit-dropdown">
        ${i18next.t('camera_position_coordinates_system_label')}
        <div class="ui item">
          <div class="ui fluid dropdown label">
            <div class="ngm-coords text">LV95</div>
            <i class="dropdown icon"></i>
            <div class="menu">
              <div class="item" @click=${() => this.coordsType = 'lv95'}>LV95</div>
              <div class="item" @click=${() => this.coordsType = 'wgs84'}>WGS84</div>
            </div>
          </div>
        </div>
      </div>
      <div class="ngm-geom-edit-coord-input">
        <div class="ngm-input">
          <input class="ngm-coord-x-input" style="${styleMap({fontSize: this.coordsType === 'lv95' ? '14px' : '16px'})}" step=${this.coordsType === 'lv95' ? 0.1 : 0.001} type="number" .value=${this.xValue.toFixed(1)}
                 @change="${this.onPositionChange}"
                 placeholder="required"/>
          <span class="ngm-floating-label">${this.coordsType === 'lv95' ? 'E' : i18next.t('tbx_lon_label')}</span>
        </div>
        <div class="ngm-input">
          <input class="ngm-coord-y-input" style="${styleMap({fontSize: this.coordsType === 'lv95' ? '14px' : '16px'})}" step=${this.coordsType === 'lv95' ? 0.1 : 0.001} type="number" .value=${this.yValue.toFixed(1)}
                 @change="${this.onPositionChange}"
                 placeholder="required"/>
          <span class="ngm-floating-label">${this.coordsType === 'lv95' ? 'N' : i18next.t('tbx_lat_label')}</span>
        </div>
      </div>
      <div class="ngm-geom-edit-double-input">
        <div class="ngm-input">
          <input class="ngm-height-input" type="number" step="0.1" .value=${this.heightValue.toFixed(1)} @change="${this.onPositionChange}"
                 placeholder="required"/>
          <span class="ngm-floating-label">${i18next.t('tbx_volume_height_label')}</span>
        </div>
        <div class="ngm-input" ?hidden=${!getValueOrUndefined(this.entity?.properties!.volumeShowed)}>
          <input type="number" step="0.1" .value=${parseFloat(getValueOrUndefined(this.entity?.properties!.depth)).toFixed(1)}
                 @change="${this.onDepthChange}" placeholder="required"/>
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
