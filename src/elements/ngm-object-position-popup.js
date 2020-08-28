import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import $ from '../jquery';
import {lv95ToDegrees} from '../projection';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Cartographic from 'cesium/Source/Core/Cartographic';
import {applyInputLimits, prepareCoordinatesForUi} from '../utils';

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
    const coordinates = prepareCoordinatesForUi(this.scene, this.position, this.coordsType);
    this.xValue = coordinates.x;
    this.yValue = coordinates.y;
    this.heightValue = coordinates.height;
  }

  onPositionChange() {
    this.xValue = Number(this.querySelector('.ngm-coord-x-input').value);
    this.yValue = Number(this.querySelector('.ngm-coord-y-input').value);
    this.heightValue = applyInputLimits(this.querySelector('.ngm-height-input'), this.minHeight, this.maxHeight);
    const altitude = this.scene.globe.getHeight(this.position) || 0;
    let lon = this.xValue;
    let lat = this.yValue;
    if (this.coordsType === 'lv95') {
      const radianCoords = lv95ToDegrees([this.xValue, this.yValue]);
      lon = radianCoords[0];
      lat = radianCoords[1];
    }
    const cartesianPosition = Cartesian3.fromDegrees(lon, lat, this.heightValue + altitude);
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
    }
    return html`
        <div class="ui mini segment" ?hidden="${!this.opened}">
            <label>${i18next.t('coordinates')}:</label>
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
            <label>${i18next.t('camera_height')}:</label></br>
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

customElements.define('ngm-object-position-popup', NgmObjectPositionPopup);
