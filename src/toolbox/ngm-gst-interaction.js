import {LitElement, html} from 'lit-element';
import {degreesToLv95, round} from '../projection.js';
import {borehole, verticalCrossSection, horizontalCrossSection} from '../gst.js';
import {showError, showWarning} from '../message.js';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import IonResource from 'cesium/Source/Core/IonResource';
import Color from 'cesium/Source/Core/Color';
import KmlDataSource from 'cesium/Source/DataSources/KmlDataSource';
import Cartographic from 'cesium/Source/Core/Cartographic';

import './ngm-gst-modal.js';
import CesiumMath from 'cesium/Source/Core/Math';
import $ from '../jquery';
import 'fomantic-ui-css/components/popup.js';

const configurePopupId = 'ngm-section-configuration';
const formatSelectorId = 'ngm-section-format';
const createBtnId = 'ngm-create-section';

/**
 * @typedef {"point" | "line" | "rectangle"} GeometryType
 */

class NgmGstInteraction extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
      gstExtent: {type: Object},
      geometryType: {type: String},
      depth: {type: Number},
      positions: {type: Array},
      parentElement: {type: Object}
    };
  }

  constructor() {
    super();

    /**
     * @type {import('cesium/Source/Widgets/Viewer/Viewer').default}
     */
    this.viewer;

    /**
     * @type {GeometryType}
     */
    this.geometryType;

    this.minDepth_ = -6000;
    this.maxDepth_ = 1000;
    this.depth = -1500;
    this.outputFormat = 'pdf';

    this.positions = null;

    this.abortController = new AbortController();
    document.addEventListener('keydown', event => {
      if (event.code === 'Escape') {
        this.abortController.abort();
        this.abortController = new AbortController();
      }
    });
  }

  firstUpdated() {
    $(this.querySelector(`#${createBtnId}`)).popup({
      position: 'top left',
      content: i18next.t('create_section_hint'),
      variation: 'mini',
      onShow: () => {
        this.gstExtent.show = true;
        this.viewer.scene.requestRender();
      },
      onHidden: () => {
        this.gstExtent.show = false;
        this.viewer.scene.requestRender();
      }
    });
    $(this.querySelector('.ngm-tools-btn')).popup({
      popup: $(this.querySelector(`#${configurePopupId}`)),
      on: 'click',
      position: 'right center'
    });
    $(this.querySelector(`#${formatSelectorId}`)).dropdown({
      onChange: value => this.outputFormat = value,
      values: [
        {name: 'PDF', value: 'pdf', selected: this.outputFormat === 'pdf'},
        {name: 'SVG', value: 'svg', selected: this.outputFormat === 'svg'},
        {name: 'PNG', value: 'png', selected: this.outputFormat === 'png'}
      ]
    });
  }

  updated() {
    this.initExtent();

    const depthField = this.querySelector('.form.depth .field');
    if (depthField) {
      if (this.hasValidDepth()) {
        depthField.classList.remove('error');
      } else {
        depthField.classList.add('error');
      }
    }
  }

  async initExtent() {
    if (this.extentInited || !this.viewer) return;
    this.extentInited = true;
    const resource = await IonResource.fromAssetId(85445);
    this.gstExtent = await KmlDataSource.load(resource, {
      camera: this.viewer.scene.camera,
      canvas: this.viewer.scene.canvas,
      clampToGround: true
    });
    this.viewer.dataSources.add(this.gstExtent);
    this.gstExtent.show = false;
    const entity = this.gstExtent.entities.values.find(ent => !!ent.polygon);
    if (entity) {
      entity.polygon.fill = true;
      entity.polygon.material = Color.RED.withAlpha(0.25);
    }
  }

  getGST() {
    if (this.hasValidParams()) {
      const coordinates = this.positions.map(position => {
        const cartographicPosition = Cartographic.fromCartesian(position);
        const lon = CesiumMath.toDegrees(cartographicPosition.longitude);
        const lat = CesiumMath.toDegrees(cartographicPosition.latitude);
        return degreesToLv95([lon, lat, cartographicPosition.height]);
      }).map(round);
      let promise;
      if (this.geometryType === 'point') {
        promise = borehole(coordinates, this.abortController.signal, this.outputFormat);
      } else if (this.geometryType === 'line') {
        promise = verticalCrossSection(coordinates, this.abortController.signal, this.outputFormat);
      } else if (this.geometryType === 'rectangle') {
        promise = horizontalCrossSection(coordinates, this.abortController.signal, this.depth, this.outputFormat);
      }
      this.loading = true;
      promise
        .then(json => {
          if (json.error) {
            showError(json.error);
          } else {
            this.parentElement.showSectionModal(json.imageUrl);
          }
        })
        .catch(err => {
          if (err.name === 'AbortError') {
            showWarning(i18next.t('request_aborted'));
          } else {
            showError(`${err.name}: ${err.message}`);
          }
        })
        .finally(() => this.loading = false);
    } else {
      console.error('invalid params');
    }
  }

  set loading(loading) {
    const buttons = this.querySelectorAll('.buttons button');

    if (loading) {
      this.viewer.canvas.style.cursor = 'wait';
      buttons.forEach(button => button.classList.add('disabled'));
    } else {
      this.viewer.canvas.style.cursor = 'default';
      buttons.forEach(button => button.classList.remove('disabled'));
    }
  }

  hasValidDepth() {
    return this.depth >= this.minDepth_ && this.depth <= this.maxDepth_;
  }

  hasValidParams() {
    if (this.positions) {
      if (this.geometryType === 'rectangle') {
        return this.hasValidDepth();
      } else {
        return true;
      }
    } else {
      return false;
    }
  }

  onDepthChange(event) {
    this.depth = event.target.value;
  }

  render() {
    return html`
        <div class="ngm-gst-btns-container">
            <div class="ui tiny buttons">
                <button id="${createBtnId}"
                        class="ui button ${this.hasValidParams() ? '' : 'disabled'}"
                        @click=${this.getGST}>
                        ${i18next.t('create_section')}
                </button>
                <button class="ui button ngm-tools-btn"><i class="tools icon"></i></button>
            </div>
        </div>
        <div id=${configurePopupId} class="ui mini popup">
        ${this.geometryType === 'rectangle' ?
      html`<label>${i18next.t('cross_sections_depth')}</label>
              <div class="ui tiny form depth">
                  <div class="field">
                    <input type="number"
                      .value="${this.depth}"
                      @change="${this.onDepthChange}"
                      min="${this.minDepth_}"
                      max="${this.maxDepth_}"
                      step="100"
                    >
                    <div class="ui small error message">
                      <p>Depth must be between ${this.minDepth_}m and ${this.maxDepth_}m</p>
                    </div>
                  </div>
        </div>` : ''}
        <label>${i18next.t('cross_sections_format')}</label>
        <div id="${formatSelectorId}" class="ui fluid selection mini dropdown">
            <div class="text"></div>
            <i class="dropdown icon"></i>
        </div>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-gst-interaction', NgmGstInteraction);
