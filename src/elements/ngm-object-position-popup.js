import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import $ from '../jquery';
import {lv95ToDegrees} from '../projection';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Cartographic from 'cesium/Source/Core/Cartographic';
import {prepareCoordinatesForUi} from '../utils';

class NgmObjectPositionPopup extends I18nMixin(LitElement) {

  static get properties() {
    return {
      scene: {type: Object},
      position: {type: Object},
      opened: {type: Boolean}
    };
  }

  constructor() {
    super();
    this.opened = false;
    this.xValue = 0;
    this.yValue = 0;
    this.heightValue = 0;
    this.coordsStep = 0.001;
    this.coordsType = 'wsg84';
  }

  updated() {
    if (this.position && !this.dropdownInited) {
      $(this.querySelector('#ngm-coord-type-select')).dropdown({
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
    const coordinates = prepareCoordinatesForUi(this.scene, this.position, this.coordsType);
    this.xValue = coordinates.x;
    this.yValue = coordinates.y;
    this.heightValue = coordinates.height;
  }

  onPositionChange() {
    this.xValue = Number(this.querySelector('#ngm-coord-x-input').value);
    this.yValue = Number(this.querySelector('#ngm-coord-y-input').value);
    this.heightValue = Number(this.querySelector('#ngm-height-input').value);
    let altitude = this.scene.globe.getHeight(this.position);
    altitude = altitude ? altitude : 0;
    let lon = this.xValue;
    let lat = this.yValue;
    const height = this.heightValue + altitude;
    if (this.coordsType === 'lv95') {
      const radianCoords = lv95ToDegrees([this.xValue, this.yValue]);
      lon = radianCoords[0];
      lat = radianCoords[1];
    }
    const cartesianPosition = Cartesian3.fromDegrees(lon, lat, height);
    this.position = Cartographic.fromCartesian(cartesianPosition);
    this.updateInputValues();
    this.dispatchEvent(new CustomEvent('positionChanged', {
      detail: {
        position: cartesianPosition
      }
    }));
  }

  render() {
    if (this.position) {
      this.updateInputValues();
      return html`
        <div class="ui mini segment" ?hidden="${!this.opened}">
            <label>${i18next.t('coordinates')}:</label>
            <div class="ngm-coord-input">
                <div class="ui mini right labeled input">
                    <div id="ngm-coord-type-select" class="ui mini dropdown label">
                          <div class="text"></div>
                          <i class="dropdown icon"></i>
                    </div>
                    <input type="number" id="ngm-coord-x-input"
                        .step="${this.coordsStep}"
                        .value="${this.xValue}"
                        @change="${this.onPositionChange}">
                </div>
                <div class="ui mini left action input">
                    <input type="number" id="ngm-coord-y-input"
                        .step="${this.coordsStep}"
                        .value="${this.yValue}"
                        @change="${this.onPositionChange}">
                </div>
            </div>
            <label>${i18next.t('camera_height')}:</label></br>
            <div class="ui mini input right labeled">
                <input type="number" step="10" id="ngm-height-input" .value="${this.heightValue}" @change="${this.onPositionChange}">
                <label for="ngm-height-input" class="ui label">m</label>
            </div>
        </div>
      `;
    } else {
      return html``;
    }
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-object-position-popup', NgmObjectPositionPopup);
