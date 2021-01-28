import {html} from 'lit-element';
import $ from '../jquery.js';
import 'fomantic-ui-css/components/popup.js';
import 'fomantic-ui-css/components/dropdown.js';
import {lv95ToDegrees} from '../projection.js';
import CesiumMath from 'cesium/Source/Core/Math';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import {LitElementI18n} from '../i18n.js';
import i18next from 'i18next';
import {prepareCoordinatesForUi} from '../cesiumutils';

class NgmPositionEdit extends LitElementI18n {

  static get properties() {
    return {
      scene: {type: Object},
      coordinates: {type: String},
      xValue: {type: Number},
      yValue: {type: Number},
      heightValue: {type: Number},
      angleValue: {type: Number},
      tiltValue: {type: Number}
    };
  }

  constructor() {
    super();

    this.coordsType = 'lv95';
    this.heightValue = 0;
    this.angleValue = 0;
    this.tiltValue = 0;
    this.xValue = 0;
    this.yValue = 0;
    this.coordsStep = 1;
  }

  firstUpdated() {
    $(this.querySelector('.ngm-coord-type-select')).dropdown({
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
    const coordinates = prepareCoordinatesForUi(this.scene, this.scene.camera.positionCartographic, this.coordsType, true);
    this.xValue = coordinates.x;
    this.yValue = coordinates.y;
    this.heightValue = coordinates.height;
    this.angleValue = Math.round(CesiumMath.toDegrees(this.scene.camera.heading));
    this.tiltValue = Math.round(CesiumMath.toDegrees(this.scene.camera.pitch));
  }

  onPositionChange() {
    this.xValue = Number(this.querySelector('.ngm-coord-x-input').value);
    this.yValue = Number(this.querySelector('.ngm-coord-y-input').value);
    this.heightValue = Number(this.querySelector('.ngm-height-input').value);
    let altitude = this.scene.globe.getHeight(this.scene.camera.positionCartographic);
    altitude = altitude ? altitude : 0;
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

  onViewChange(event) {
    if (event.target.classList.contains('ngm-angle-input')) {
      this.angleValue = Number(event.target.value);
    } else {
      this.tiltValue = Number(event.target.value);
    }
    this.scene.camera.setView({
      orientation: {
        heading: CesiumMath.toRadians(this.angleValue),
        pitch: CesiumMath.toRadians(this.tiltValue)
      }
    });
    this.updateInputValues();
  }

  get popupContent() {
    return html`
    <div id="ngm-position-edit-popup" class="ui custom popup">
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
        </div>
        <div class="ngm-angle-height-input">
            <div>
                <label>${i18next.t('nav_camera_height_label')}:</label>
                <div class="ui mini input right labeled">
                    <input type="number" step="10" class="ngm-height-input" .value="${this.heightValue}" @change="${this.onPositionChange}">
                    <label class="ui label">m</label>
                </div>
            </div>
            <div>
                <label>${i18next.t('nav_view_angle_label')}:</label>
                <div class="ui mini input right labeled">
                    <input type="number" class="ngm-angle-input" .value="${this.angleValue}" @change="${this.onViewChange}">
                    <label class="ui label">°</label>
                </div>
            </div>
            <div>
                <label>${i18next.t('nav_view_tilt_label')}:</label>
                <div class="ui mini input right labeled">
                    <input type="number" class="ngm-tilt-input" .value="${this.tiltValue}" @change="${this.onViewChange}">
                    <label class="ui label">°</label>
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
