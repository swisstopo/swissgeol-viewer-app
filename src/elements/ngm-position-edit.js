import {LitElement, html} from 'lit-element';
import $ from '../jquery.js';
import 'fomantic-ui-css/components/popup.js';
import 'fomantic-ui-css/components/dropdown.js';
import {degreesToLv95, lv95ToDegrees} from '../projection.js';
import CesiumMath from 'cesium/Core/Math';
import Cartesian3 from 'cesium/Core/Cartesian3';
import {I18nMixin} from '../i18n.js';
import i18next from 'i18next';

class NgmPositionEdit extends I18nMixin(LitElement) {

  static get properties() {
    return {
      coordinates: {type: String},
      xValue: {type: Number},
      yValue: {type: Number},
      heightValue: {type: Number},
      angleValue: {type: Number}
    };
  }

  constructor() {
    super();

    this.coordsType = 'lv95';
    this.heightValue = 0;
    this.angleValue = 0;
    this.xValue = 0;
    this.yValue = 0;
    this.coordsStep = 1;
  }

  firstUpdated() {
    $(this.querySelector('#ngm-coord-type-select')).dropdown({
      onChange: value => {
        this.coordsType = value;
        this.coordsStep = value === 'lv95' ? 100 : 0.001;
        this.updateInputValues();
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

    $(this.querySelector('#ngm-position-edit-btn')).popup(
      {
        on: 'click',
        popup: $(this.querySelector('#ngm-position-edit-popup')),
        position: 'bottom right',
        delay: {
          show: 0,
          hide: 0
        },
        onShow: () => {
          this.updateInputValues();
          document.addEventListener('keyup', this.onKeyUp);
        },
        onHide: () => document.removeEventListener('keyup', this.onKeyUp)
      }
    );
  }

  updateInputValues() {
    const position = this.scene.camera.positionCartographic;
    const lon = CesiumMath.toDegrees(position.longitude);
    const lat = CesiumMath.toDegrees(position.latitude);
    if (this.coordsType === 'lv95') {
      const coords = degreesToLv95([lon, lat]);
      this.xValue = Math.round(coords[0]);
      this.yValue = Math.round(coords[1]);
    } else {
      this.xValue = Number(lon.toFixed(6));
      this.yValue = Number(lat.toFixed(6));
    }
    const altitude = this.scene.globe.getHeight(position);
    this.heightValue = Math.round(position.height - altitude);
    this.angleValue = Math.round(CesiumMath.toDegrees(this.scene.camera.heading));
  }

  onPositionChange() {
    this.xValue = Number(this.querySelector('#ngm-coord-x-input').value);
    this.yValue = Number(this.querySelector('#ngm-coord-y-input').value);
    this.heightValue = Number(this.querySelector('#ngm-height-input').value);
    const altitude = this.scene.globe.getHeight(this.scene.camera.positionCartographic);
    let lon = this.xValue;
    let lat = this.yValue;
    const height = this.heightValue + altitude;
    if (this.coordsType === 'lv95') {
      const radianCoords = lv95ToDegrees([this.xValue, this.yValue]);
      lon = radianCoords[0];
      lat = radianCoords[1];
    }
    this.scene.camera.position = Cartesian3.fromDegrees(lon, lat, height);
    this.updateInputValues();
  }

  onAngleChange(event) {
    this.angleValue = Number(event.target.value);
    this.scene.camera.setView({
      orientation: {
        heading: CesiumMath.toRadians(this.angleValue),
        pitch: this.scene.camera.pitch
      }
    });
    this.updateInputValues();
  }

  get popupContent() {
    return html`
    <div id="ngm-position-edit-popup" class="ui custom popup">
        <div>
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
        </div>
        <div class="ngm-angle-height-input">
            <div>
                <label>${i18next.t('camera_height')}:</label>
                <div class="ui mini input right labeled">
                    <input type="number" step="10" id="ngm-height-input" .value="${this.heightValue}" @change="${this.onPositionChange}">
                    <label for="ngm-height-input" class="ui label">m</label>
                </div>
            </div>
            <div>
                <label>${i18next.t('view_angle')}:</label>
                <div class="ui mini input right labeled">
                    <input type="number" id="ngm-angle-input" .value="${this.angleValue}" @change="${this.onAngleChange}">
                    <label for="ngm-angle-input" class="ui label">°</label>
                </div>
            </div>
        </div>
    </div>
    `;
  }

  onKeyUp(event) {
    if (event.target.tagName.toLowerCase() !== 'input') {
      this.querySelector('ngm-position-edit').updateInputValues();
    }
  }

  render() {
    return html`
    ${this.popupContent}
    <button id="ngm-position-edit-btn" class="ui icon button mini">
        <i class="pen icon"></i>
    </button>
    `;
  }

  createRenderRoot() {
    return this;
  }

}

customElements.define('ngm-position-edit', NgmPositionEdit);
