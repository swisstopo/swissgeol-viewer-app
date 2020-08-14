import {LitElement, html} from 'lit-element';
import draggable from './draggable.js';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import $ from '../jquery';
import CesiumMath from "cesium/Source/Core/Math";
import {degreesToLv95} from '../projection';

class NgmObjectPositionPopup extends I18nMixin(LitElement) {

  static get properties() {
    return {
      position: {type: Object},
      opened: {type: Boolean}
    };
  }

  constructor() {
    super();
    this.opened = false;
    this.xValue = 0;
    this.yValue = 0;
    this.coordsStep = 1;

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.opened = false;
      }
    });
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
  }

  updateInputValues() {
    const position = this.position;
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
  }

  onPositionChange() {

  }

  render() {
    if (this.position) {
      return html`
        <div class="ui segment" ?hidden="${!this.opened}">
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
