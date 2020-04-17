import {LitElement, html} from 'lit-element';
import {CesiumDraw} from '../draw/CesiumDraw.js';
import {degreesToLv95, round} from '../projection.js';
import {borehole, verticalCrossSection, horizontalCrossSection} from '../gst.js';
import {showError, showWarning} from '../message.js';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import IonResource from 'cesium/Core/IonResource.js';
import Color from 'cesium/Core/Color.js';
import KmlDataSource from 'cesium/DataSources/KmlDataSource.js';

import './ngm-gst-modal.js';

const CSS_ACTIVE_CLASS = 'grey';

class NgmGstInteraction extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
      gstExtent: {type: Object},
      tool: {type: String},
      depth: {type: Number}
    };
  }

  constructor() {
    super();

    this.minDepth_ = -6000;
    this.maxDepth_ = 0;
    this.depth = -1500;

    this.positions_ = null;
  }

  updated() {
    if (!this.draw_ && this.viewer) {
      this.draw_ = new CesiumDraw(this.viewer, 'line');
      this.draw_.addEventListener('drawstart', () => this.clear());
      this.draw_.addEventListener('drawend', (event) => {
        this.positions_ = event.detail.positions;
        this.getGST();
      });
      this.draw_.addEventListener('drawerror', evt => {
        if (this.draw_.ERROR_TYPES.needMorePoints === evt.detail.error) {
          showWarning(i18next.t('error_need_more_points'));
        }
      });
    }
    this.initExtent();

    const depthField = this.querySelector('.form.depth .field');
    if (this.hasValidDepth()) {
      depthField.classList.remove('error');
    } else {
      depthField.classList.add('error');
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
      entity.polygon.material = Color.RED.withAlpha(0.1);
    }
  }

  clear() {
    this.positions_ = null;
    this.draw_.clear();
  }

  getGST() {
    if (this.hasValidParams()) {
      const coordinates = this.positions_.map(degreesToLv95).map(round);
      let promise;
      if (this.tool === 'borehole') {
        promise = borehole(coordinates);
      } else if (this.tool === 'crossSection') {
        promise = verticalCrossSection(coordinates);
      } else if (this.tool === 'horizontalCrossSection') {
        promise = horizontalCrossSection(coordinates, this.depth);
      }
      this.loading = true;
      promise
        .then(json => {
          this.imageUrl = json.imageUrl;
          this.requestUpdate();
        })
        .catch(err => showError(`${err.name}: ${err.message}`))
        .finally(() => this.loading = false);
    } else {
      console.error('invalid params');
    }
  }

  set loading(loading) {
    const buttons = this.querySelectorAll('.buttons button');
    const form = this.querySelector('.form.depth');

    if (loading) {
      this.viewer.canvas.style.cursor = 'wait';
      form.classList.add('loading');
      buttons.forEach(button => button.classList.add('disabled'));
    } else {
      this.viewer.canvas.style.cursor = 'default';
      form.classList.remove('loading');
      buttons.forEach(button => button.classList.remove('disabled'));
    }
    this.draw_.active = !loading;
  }

  hasValidDepth() {
    return this.depth >= this.minDepth_ && this.depth <= this.maxDepth_;
  }

  hasValidParams() {
    if (this.positions_) {
      if (this.tool === 'horizontalCrossSection') {
        return this.hasValidDepth();
      } else {
        return true;
      }
    } else {
      return false;
    }
  }

  changeTool(event, tool, type) {
    if (this.draw_) {
      this.tool = tool;
      this.querySelectorAll('button').forEach(button => button.classList.remove(CSS_ACTIVE_CLASS));

      this.clear();
      this.viewer.scene.requestRender();
      if (this.draw_.active && (this.draw_.type === type || !type)) {
        // turn it off
        this.draw_.active = false;
        this.gstExtent.show = false;
      } else if (event && type) {
        this.draw_.type = type;
        this.draw_.active = true;
        this.gstExtent.show = true;
        event.currentTarget.classList.add(CSS_ACTIVE_CLASS);
      }
    }
  }

  onDepthChange(event) {
    this.depth = event.target.value;
  }

  toggleBoreHole(event) {
    this.changeTool(event, 'borehole', 'point');
  }

  toggleCrossSection(event) {
    this.changeTool(event, 'crossSection', 'line');
  }

  toggleHorizontalCrossSection(event) {
    this.changeTool(event, 'horizontalCrossSection', 'rectangle');
  }

  render() {
    return html`
      <div class="ui tiny icon buttons">
        <button class="ui button" @click="${this.toggleBoreHole}"
          data-tooltip=${i18next.t('Borehole')}
          data-position="top center"
          data-variation="mini"
        >
          <i class="ruler vertical icon"></i>
        </button>
        <button class="ui button" @click="${this.toggleCrossSection}"
          data-tooltip=${i18next.t('Vertical cross sections')}
          data-position="top center"
          data-variation="mini"
        >
          <i class="map icon"></i>
        </button>
        <button class="ui button" @click="${this.toggleHorizontalCrossSection}"
          data-tooltip=${i18next.t('Horizontal cross sections')}
          data-position="top center"
          data-variation="mini"
        >
          <i class="horizontal-layer svg-icon icon"></i>
        </button>
      </div>
      <div class="ui segments" ?hidden="${this.tool !== 'horizontalCrossSection'}">
        <div class="ui segment">
          <div class="ui tiny form depth">
            <div class="field">
              <label>${i18next.t('cross_sections_depth')}</label>
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
            <div class="ui tiny submit button ${this.hasValidParams() ? '' : 'disabled'}" @click="${this.getGST}">
              ${i18next.t('get_result')}
            </div>
          </div>
        </div>
      </div>
      <ngm-gst-modal .imageUrl="${this.imageUrl}"></ngm-gst-modal>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-gst-interaction', NgmGstInteraction);
