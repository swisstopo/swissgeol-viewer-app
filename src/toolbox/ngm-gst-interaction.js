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

    this.positions = null;

    this.abortController = new AbortController();
    document.addEventListener('keydown', event => {
      if (event.code === 'Escape') {
        this.abortController.abort();
        this.abortController = new AbortController();
      }
    });
  }

  // updated() {
  //   if (!this.draw_ && this.viewer) {
  //     this.draw_ = new CesiumDraw(this.viewer, 'line');
  //     this.draw_.addEventListener('drawstart', () => this.clear());
  //     this.draw_.addEventListener('drawend', (event) => {
  //       this.positions = event.detail.positions;
  //       this.getGST();
  //     });
  //     this.draw_.addEventListener('drawerror', evt => {
  //       if (this.draw_.ERROR_TYPES.needMorePoints === evt.detail.error) {
  //         showWarning(i18next.t('error_need_more_points'));
  //       }
  //     });
  //   }
  //   this.initExtent();
  //
  //   const depthField = this.querySelector('.form.depth .field');
  //   if (this.hasValidDepth()) {
  //     depthField.classList.remove('error');
  //   } else {
  //     depthField.classList.add('error');
  //   }
  // }

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

  // clear() {
  //   this.positions = null;
  //   this.draw_.clear();
  // }

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
        promise = borehole(coordinates, this.abortController.signal);
      } else if (this.geometryType === 'line') {
        promise = verticalCrossSection(coordinates, this.abortController.signal);
      } else if (this.geometryType === 'rectangle') {
        promise = horizontalCrossSection(coordinates, this.abortController.signal, this.depth);
      }
      this.loading = true;
      promise
        .then(json => {
          this.parentElement.showSectionModal(json.imageUrl);
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
    // const buttons = this.querySelectorAll('.buttons button');
    // const form = this.querySelector('.form.depth');

    if (loading) {
      this.viewer.canvas.style.cursor = 'wait';
      // form.classList.add('loading');
      // buttons.forEach(button => button.classList.add('disabled'));
    } else {
      this.viewer.canvas.style.cursor = 'default';
      // form.classList.remove('loading');
      // buttons.forEach(button => button.classList.remove('disabled'));
    }
    // this.draw_.active = !loading;
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
        <div class="ui tiny buttons">
            <button class="ui button" @click=${this.getGST}>Create section</button>
            <button class="ui button"><i class="tools icon"></i></button>
        </div>`;
    // return html`
    //   <div class="ui tiny icon buttons">
    //     <button class="ui button" @click="${this.toggleBoreHole}"
    //       data-tooltip=${i18next.t('Borehole')}
    //       data-position="top center"
    //       data-variation="mini"
    //     >
    //       <i class="ruler vertical icon"></i>
    //     </button>
    //     <button class="ui button" @click="${this.toggleCrossSection}"
    //       data-tooltip=${i18next.t('Vertical cross sections')}
    //       data-position="top center"
    //       data-variation="mini"
    //     >
    //       <i class="map icon"></i>
    //     </button>
    //     <button class="ui button" @click="${this.toggleHorizontalCrossSection}"
    //       data-tooltip=${i18next.t('Horizontal cross sections')}
    //       data-position="top center"
    //       data-variation="mini"
    //     >
    //       <i class="horizontal-layer svg-icon icon"></i>
    //     </button>
    //   </div>
    //   <div class="ui segments" ?hidden="${this.tool !== 'horizontalCrossSection'}">
    //     <div class="ui segment">
    //       <div class="ui tiny form depth">
    //         <div class="field">
    //           <label>${i18next.t('cross_sections_depth')}</label>
    //           <input type="number"
    //             .value="${this.depth}"
    //             @change="${this.onDepthChange}"
    //             min="${this.minDepth_}"
    //             max="${this.maxDepth_}"
    //             step="100"
    //           >
    //           <div class="ui small error message">
    //             <p>Depth must be between ${this.minDepth_}m and ${this.maxDepth_}m</p>
    //           </div>
    //         </div>
    //         <div class="ui tiny submit button ${this.hasValidParams() ? '' : 'disabled'}" @click="${this.getGST}">
    //           ${i18next.t('get_result')}
    //         </div>
    //       </div>
    //     </div>
    //   </div>
    //   <div class="ui tertiary center aligned segment">
    //         ${this.getHintText}
    //   </div>
    //   <ngm-gst-modal .imageUrl="${this.imageUrl}"></ngm-gst-modal>
    // `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-gst-interaction', NgmGstInteraction);
