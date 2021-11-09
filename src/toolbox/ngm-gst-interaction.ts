import {html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {degreesToLv95, round} from '../projection.js';
import {borehole, verticalCrossSection, horizontalCrossSection} from '../gst';
import {showError, showWarning} from '../notifications';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import IonResource from 'cesium/Source/Core/IonResource';
import Color from 'cesium/Source/Core/Color';
import KmlDataSource from 'cesium/Source/DataSources/KmlDataSource';
import Cartographic from 'cesium/Source/Core/Cartographic';

import './ngm-gst-modal';
import '../elements/ngm-i18n-content.js';
import CesiumMath from 'cesium/Source/Core/Math';
import $ from '../jquery';
import 'fomantic-ui-css/components/popup.js';
import MainStore from '../store/main';
import {Cartesian3, Viewer} from 'cesium';

export type OutputFormat = 'pdf' | 'png' | 'svg';

@customElement('ngm-gst-interaction')
export class NgmGstInteraction extends LitElementI18n {
  @property({type: Object}) gstExtent: KmlDataSource | undefined;
  @property({type: String}) geometryType: 'point' | 'line' | 'rectangle' | '' = '';
  @property({type: Number}) depth = 0;
  @property({type: Array}) positions: Cartesian3[] | null = null;
  @property({type: Object}) parentElement;
  private viewer: Viewer | null = null;
  private minDepth_ = -6000;
  private maxDepth_ = 1000;
  private outputFormat: OutputFormat = 'pdf';
  private abortController = new AbortController();
  private extentInited = false;

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
    this.depth = -1500;

    document.addEventListener('keydown', event => {
      if (event.code === 'Escape') {
        this.abortController.abort();
        this.abortController = new AbortController();
      }
    });
  }

  firstUpdated() {
    // FIXME: update the i18n extractor to collect the 'key' from ngm-i18n-content
    // workaround: t('tbx_create_section_hint')
    $(this.querySelector('.ngm-create-section')).popup({
      position: 'top left',
      html: '<ngm-i18n-content key="tbx_create_section_hint"></ngm-i18n-content>',
      variation: 'mini',
      onShow: () => this.switchExtent(true),
      onHidden: () => this.switchExtent(false)
    });
    $(this.querySelector('.ngm-tools-btn')).popup({
      popup: $(this.querySelector('.ngm-section-configuration')),
      on: 'click',
      position: 'right center'
    });
    $(this.querySelector('.ngm-section-format')).dropdown({
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
    if (entity && entity.polygon) {
      entity.polygon.fill = <any>true;
      entity.polygon.material = <any>Color.RED.withAlpha(0.25);
    }
  }

  getGST() {
    if (this.hasValidParams()) {
      const coordinates = this.positions!.map(position => {
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
            showWarning(i18next.t('tbx_request_aborted_warning'));
          } else {
            console.error(err);
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
      this.viewer!.canvas.style.cursor = 'wait';
      buttons.forEach(button => button.classList.add('disabled'));
    } else {
      this.viewer!.canvas.style.cursor = 'default';
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

  switchExtent(show) {
    this.gstExtent!.show = show;
    this.viewer!.scene.requestRender();
  }

  render() {
    return html`
      <div class="ngm-gst-btns-container">
        <div class="ui tiny buttons">
          <button class="ui button ngm-create-section ${this.hasValidParams() ? '' : 'disabled'}"
                  @click=${this.getGST}>
            ${i18next.t('tbx_create_section_label')}
          </button>
          <button class="ui icon button ngm-tools-btn"><i class="tools icon"></i></button>
        </div>
      </div>
      <div class="ui mini popup ngm-section-configuration">
        ${this.geometryType === 'rectangle' ?
          html`<label>${i18next.t('tbx_cross_sections_depth_label')}</label>
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
                <p>${i18next.t('tbx_depth_warning', {minDepth: this.minDepth_, maxDepth: this.maxDepth_})}</p>
              </div>
            </div>
          </div>` : ''}
        <label>${i18next.t('tbx_cross_sections_format_label')}</label>
        <div class="ui fluid selection mini dropdown ngm-section-format">
          <div class="text"></div>
          <i class="dropdown icon"></i>
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}