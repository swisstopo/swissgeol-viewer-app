import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import $ from '../jquery';
import {lv95ToDegrees} from '../projection';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Cartographic from 'cesium/Source/Core/Cartographic';
import {applyInputLimits, prepareCoordinatesForUi} from '../utils';

class NgmPointPosition extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
      position: {type: Object},
      entity: {type: Object}
    };
  }

  constructor() {
    super();
    this.xValue = 0;
    this.yValue = 0;
    this.heightValue = 0;
    this.coordsStep = 0.001;
    this.coordsType = 'wsg84';
    this.minHeight = -30000;
    this.maxHeight = 30000;
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
    const cartographicPosition = Cartographic.fromCartesian(this.position);
    const coordinates = prepareCoordinatesForUi(this.viewer.scene, cartographicPosition, this.coordsType);
    this.xValue = coordinates.x;
    this.yValue = coordinates.y;
    this.heightValue = coordinates.height;
  }

  onPositionChange() {
    const cartographicPosition = Cartographic.fromCartesian(this.position);
    this.xValue = Number(this.querySelector('.ngm-coord-x-input').value);
    this.yValue = Number(this.querySelector('.ngm-coord-y-input').value);
    this.heightValue = applyInputLimits(this.querySelector('.ngm-height-input'), this.minHeight, this.maxHeight);
    const altitude = this.viewer.scene.globe.getHeight(cartographicPosition) || 0;
    let lon = this.xValue;
    let lat = this.yValue;
    if (this.coordsType === 'lv95') {
      const radianCoords = lv95ToDegrees([this.xValue, this.yValue]);
      lon = radianCoords[0];
      lat = radianCoords[1];
    }
    const cartesianPosition = Cartesian3.fromDegrees(lon, lat, this.heightValue + altitude);
    this.position = cartesianPosition;
    this.updateInputValues();
    this.entity.position = cartesianPosition;
    this.viewer.scene.requestRender();
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
                    <input type="number" class="ngm-coord-x-input"
                        .step="${this.coordsStep}"
                        .value="${this.xValue}"
                        @change="${this.onPositionChange}">
                </div>
                <div class="ui mini left action input">
                    <input type="number" class="ngm-coord-y-input"
                        .step="${this.coordsStep}"
                        .value="${this.yValue}"
                        @change="${this.onPositionChange}">
                </div>
            </div>
            <label>${i18next.t('nav_camera_height_label')}:</label></br>
            <div class="ui mini input right labeled">
                <input type="number" step="10" min="${this.minHeight}" max="${this.maxHeight}"
                    class="ngm-height-input" .value="${this.heightValue}" @change="${this.onPositionChange}">
                <label class="ui label">m</label>
            </div>
        </div>
      `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-point-position', NgmPointPosition);
