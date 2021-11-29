import {html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {degreesToLv95, round} from '../projection.js';
import {borehole, horizontalCrossSection, verticalCrossSection} from '../gst';
import {showError, showSnackbarInfo} from '../notifications';
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
import {Viewer} from 'cesium';
import {NgmToolbox} from './ngm-toolbox';
import {classMap} from 'lit-html/directives/class-map.js';

export type OutputFormat = 'pdf' | 'png' | 'svg';

@customElement('ngm-gst-interaction')
export class NgmGstInteraction extends LitElementI18n {
  @state() gstExtent: KmlDataSource | undefined;
  @state() depth = {};
  @state() selectedId: string | undefined;
  private viewer: Viewer | null = null;
  private minDepth_ = -6000;
  private maxDepth_ = 1000;
  private outputFormat: OutputFormat = 'pdf';
  private abortController = new AbortController();
  private extentInited = false;

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);

    document.addEventListener('keydown', event => {
      if (event.code === 'Escape') {
        this.abortController.abort();
        this.abortController = new AbortController();
      }
    });
  }

  update(changedProperties) {
    this.initExtent();
    if (changedProperties.has('selectedId')) this.initDropdowns();

    super.update(changedProperties);
  }

  initDropdowns() {
    this.querySelectorAll('.ngm-section-format').forEach(el => $(el).dropdown({
      onChange: value => this.outputFormat = value,
      values: [
        {name: 'PDF', value: 'pdf', selected: this.outputFormat === 'pdf'},
        {name: 'SVG', value: 'svg', selected: this.outputFormat === 'svg'},
        {name: 'PNG', value: 'png', selected: this.outputFormat === 'png'}
      ]
    }));
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
    await this.viewer.dataSources.add(this.gstExtent);
    this.gstExtent.show = false;
    const entity = this.gstExtent.entities.values.find(ent => !!ent.polygon);
    if (entity && entity.polygon) {
      entity.polygon.fill = <any>true;
      entity.polygon.material = <any>Color.RED.withAlpha(0.25);
    }
  }

  getGST(geom) {
    if (this.hasValidParams(geom)) {
      const coordinates = geom.positions.map(position => {
        const cartographicPosition = Cartographic.fromCartesian(position);
        const lon = CesiumMath.toDegrees(cartographicPosition.longitude);
        const lat = CesiumMath.toDegrees(cartographicPosition.latitude);
        return degreesToLv95([lon, lat, cartographicPosition.height]);
      }).map(round);
      let promise;
      if (geom.type === 'point') {
        promise = borehole(coordinates, this.abortController.signal, this.outputFormat);
      } else if (geom.type === 'line') {
        promise = verticalCrossSection(coordinates, this.abortController.signal, this.outputFormat);
      } else if (geom.type === 'rectangle') {
        promise = horizontalCrossSection(coordinates, this.abortController.signal, this.depth[geom.id], this.outputFormat);
      }
      this.loading = true;
      promise
        .then(json => {
          if (json.error) {
            showError(json.error);
          } else {
            (<NgmToolbox> this.parentElement).showSectionModal(json.imageUrl);
          }
        })
        .catch(err => {
          if (err.name === 'AbortError') {
            showSnackbarInfo(i18next.t('tbx_request_aborted_warning'));
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

  hasValidDepth(id) {
    return this.depth[id] >= this.minDepth_ && this.depth[id] <= this.maxDepth_;
  }

  hasValidParams(geom) {
    if (geom.positions) {
      if (geom.type === 'rectangle') {
        return this.hasValidDepth(geom.id);
      } else {
        return true;
      }
    } else {
      return false;
    }
  }

  onDepthChange(event, id) {
    this.depth = {...this.depth, [id]: Number(event.target.value)};
  }

  switchExtent(show) {
    this.gstExtent!.show = show;
    this.viewer!.scene.requestRender();
  }

  interactionTemplate(geom) {
    if (this.depth[geom.id] === undefined) this.depth[geom.id] = -1500;
    return html`
      <div class="ngm-gst-container" ?hidden=${geom.id !== this.selectedId}>
        <div class="ngm-input ${classMap({'ngm-input-warning': !this.hasValidDepth(geom.id)})}"
             ?hidden=${geom.type !== 'rectangle'}>
          <input type="number" placeholder="required"
                 .value=${this.depth[geom.id]}
                 @input=${evt => this.onDepthChange(evt, geom.id)}
                 min="${this.minDepth_}"
                 max="${this.maxDepth_}"
                 step="100"/>
          <span class="ngm-floating-label">${i18next.t('tbx_cross_sections_depth_label')}</span>
        </div>
        <div class="ngm-section-format-container">
          <label>${i18next.t('tbx_cross_sections_format_label')}</label>
          <div class="ui fluid dropdown ngm-section-format">
            <div class="text"></div>
            <i class="dropdown icon"></i>
          </div>
        </div>
        <button class="ui button ngm-action-btn ${this.hasValidParams(geom) ? '' : 'disabled'}"
                @click=${() => this.getGST(geom)}
                @mouseenter=${() => this.switchExtent(true)}
                @mouseleave=${() => this.switchExtent(false)}>
          ${i18next.t('tbx_create_section_label')}
        </button>
      </div>
    `;
  }

  render() {
    return html`
      <ngm-geometries-list
        .selectedId=${this.selectedId}
        .disabledTypes=${['polygon']}
        .optionsTemplate=${(geom) => this.interactionTemplate(geom)}
        @geomclick=${evt => this.selectedId = this.selectedId === evt.detail.id ? undefined : evt.detail.id}>
      </ngm-geometries-list>`;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
