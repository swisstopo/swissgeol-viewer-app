import {html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {cartesianToLv95, round} from '../projection';
import {borehole, horizontalCrossSection, verticalCrossSection} from '../gst';
import {showSnackbarError, showSnackbarInfo} from '../notifications';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import {IonResource, Color, KmlDataSource, Cartographic, JulianDate} from 'cesium';
import './ngm-gst-modal';
import '../elements/ngm-i18n-content.js';
import $ from '../jquery';
import 'fomantic-ui-css/components/popup.js';
import MainStore from '../store/main';
import type {Viewer} from 'cesium';
import type {NgmToolbox} from './ngm-toolbox';
import {classMap} from 'lit-html/directives/class-map.js';
import ToolboxStore from '../store/toolbox';
import type {NgmGeometry} from './interfaces';
import {pointInPolygon} from '../cesiumutils';

export type OutputFormat = 'pdf' | 'png' | 'svg';

@customElement('ngm-gst-interaction')
export class NgmGstInteraction extends LitElementI18n {
  @property({type: Boolean}) hidden = true;
  @state() gstExtent: KmlDataSource | undefined;
  @state() depth = {};
  @state() selectedId: string | undefined;
  private viewer: Viewer | null = null;
  private minDepth_ = -6000;
  private maxDepth_ = 1000;
  private outputFormat: OutputFormat = 'pdf';
  private abortController = new AbortController();
  private extentInited = false;
  private extentPositions: Cartographic[] = [];

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => {
      this.viewer = viewer;
      this.initExtent().then(() => {
        if (this.gstExtent?.show !== !this.hidden)
          this.switchExtent(!this.hidden);
      });
    });

    document.addEventListener('keydown', event => {
      if (event.code === 'Escape') {
        this.abortController.abort();
        this.abortController = new AbortController();
      }
    });
  }

  update(changedProperties) {
    if (this.gstExtent?.show !== !this.hidden)
      this.switchExtent(!this.hidden);
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
      this.extentPositions = entity.polygon.hierarchy
        ?.getValue(new JulianDate()).positions
        .map(p => Cartographic.fromCartesian(p));
    }
  }

  getGST(geom: NgmGeometry) {
    if (this.hasValidParams(geom)) {
      const coordinates = geom.positions.map(position => cartesianToLv95(position)).map(round);
      let promise;
      if (geom.type === 'point') {
        promise = borehole(coordinates, this.abortController.signal, this.outputFormat);
      } else if (geom.type === 'line') {
        promise = verticalCrossSection(coordinates, this.abortController.signal, this.outputFormat);
      } else if (geom.type === 'rectangle') {
        promise = horizontalCrossSection(coordinates, this.abortController.signal, this.depth[geom.id!], this.outputFormat);
      }
      this.loading = true;
      promise
        .then(json => {
          if (json.error) {
            showSnackbarError(json.error);
          } else {
            (<NgmToolbox> this.parentElement).showSectionModal(json.imageUrl);
          }
        })
        .catch(err => {
          if (err.name === 'AbortError') {
            showSnackbarInfo(i18next.t('tbx_request_aborted_warning'));
          } else {
            console.error(err);
            showSnackbarError(`${err.name}: ${err.message}`);
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

  hasValidParams(geom: NgmGeometry) {
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

  switchExtent(show: boolean) {
    if (!this.gstExtent) return;
    this.gstExtent.show = show;
    this.viewer!.scene.requestRender();
  }

  onGeomClick(geom: NgmGeometry) {
    this.selectedId = this.selectedId === geom.id ? undefined : geom.id;
    ToolboxStore.nextGeometryAction({id: geom.id, action: 'pick'});
  }

  geometryOutsideExtent(geom) {
    const points = geom.positions.map(p => Cartographic.fromCartesian(p));
    let inside = false;
    for (let i = 0; i < points.length; i++) {
      inside = pointInPolygon(points[i], this.extentPositions);
      if (inside) break;
    }
    return !inside;
  }

  onGeometryAdded(newGeometries: NgmGeometry[]) {
    if (this.hidden) return;
    let valid = false;
    for (const geom of newGeometries) {
      if (geom.type !== 'polygon') {
        valid = !this.geometryOutsideExtent(geom);
        if (valid) {
          this.onGeomClick(geom);
          break;
        }
      }
    }
    if (!valid) {
      showSnackbarError(i18next.t('tbx_gst_no_models_in_region_error'));
    }
  }

  interactionTemplate(geom: NgmGeometry, active: boolean) {
    if (!geom.id) return '';
    if (this.depth[geom.id] === undefined) this.depth[geom.id] = -1500;
    return html`
      <div class="ngm-gst-container" ?hidden=${geom.id !== this.selectedId || !active}>
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
        <button class="ui button ngm-action-btn ${classMap({disabled: !this.hasValidParams(geom)})}"
                @click=${() => this.getGST(geom)}>
          ${i18next.t('tbx_create_section_label')}
        </button>
      </div>
    `;
  }

  render() {
    return html`
      <ngm-draw-section ?hidden=${this.hidden} .enabledTypes=${['line', 'rectangle', 'point']}></ngm-draw-section>
      <div class="ngm-divider"></div>
      <ngm-geometries-list
        .selectedId=${this.selectedId}
        .disabledTypes=${['polygon']}
        .disabledCallback=${geom => this.geometryOutsideExtent(geom)}
        .optionsTemplate=${(geom, active) => this.interactionTemplate(geom, active)}
        @geomclick=${evt => this.onGeomClick(evt.detail)}
        @geometriesadded=${evt => this.onGeometryAdded(evt.detail.newGeometries)}>
      </ngm-geometries-list>
      <ngm-geometries-list
        title=${i18next.t('tbx_geometries_from_topic')}
        .disabledTypes=${['polygon']}
        .disabledCallback=${geom => this.geometryOutsideExtent(geom)}
        .geometryFilter=${(geom: NgmGeometry) => geom.fromTopic}
      ></ngm-geometries-list>`;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
