import {html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {cartesianToLv95, round} from '../projection';
import {showSnackbarError, showSnackbarInfo} from '../notifications';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import type {Viewer} from 'cesium';
import {Cartographic, Color, IonResource, JulianDate, KmlDataSource} from 'cesium';
import './ngm-gst-modal';
import '../elements/ngm-i18n-content.js';
import 'fomantic-ui-css/components/popup.js';
import MainStore from '../store/main';
import type {NgmToolbox} from './ngm-toolbox';
import {classMap} from 'lit-html/directives/class-map.js';
import ToolboxStore from '../store/toolbox';
import type {NgmGeometry} from './interfaces';
import {pointInPolygon} from '../cesiumutils';
import {gstServiceContext} from '../context';
import {consume} from '@lit/context';
import {GstService} from '../gst.service';

export type OutputFormat = 'pdf' | 'png' | 'svg';

@customElement('ngm-gst-interaction')
export class NgmGstInteraction extends LitElementI18n {
  @property({type: Boolean})
  accessor hidden = true
  @state()
  accessor gstExtent: KmlDataSource | undefined
  @state()
  accessor depth = {}
  @state()
  accessor selectedId: string | undefined

  @consume({context: gstServiceContext})
  accessor gstService!: GstService

  private viewer: Viewer | null = null;
  private readonly minDepth_ = -6000;
  private readonly maxDepth_ = 1000;
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
      onChange: value => this.outputFormat = value as OutputFormat,
      values: [
        {name: 'PDF', value: 'pdf', selected: this.outputFormat === 'pdf'},
        {name: 'SVG', value: 'svg', selected: this.outputFormat === 'svg'},
        {name: 'PNG', value: 'png', selected: this.outputFormat === 'png'},
      ],
    }));
  }

  async initExtent() {
    if (this.extentInited || !this.viewer) return;
    this.extentInited = true;
    const resource = await IonResource.fromAssetId(2315015);
    this.gstExtent = await KmlDataSource.load(resource, {
      camera: this.viewer.scene.camera,
      canvas: this.viewer.scene.canvas,
      clampToGround: true,
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

  async getGST(geom: NgmGeometry) {
    if (!this.hasValidParams(geom)) {
      throw new Error('invalid params');
    }
    this.loading = true;
    try {
      const json = await this.fetchGstGeometry(geom);
      if (json.error) {
        showSnackbarError(json.error);
        return;
      }
      (this.parentElement as NgmToolbox).showSectionModal(json.imageUrl);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        showSnackbarInfo(i18next.t('tbx_request_aborted_warning'));
        return;
      }
      console.error(err);
      showSnackbarError(`${err.name}: ${err.message}`);
    } finally {
      this.loading = false;
    }
  }

  private fetchGstGeometry(geom: NgmGeometry): Promise<any> {
    const coords = geom.positions.map(position => cartesianToLv95(position)).map(round);
    switch (geom.type) {
      case 'point':
        return this.gstService.borehole({
          coords,
          signal: this.abortController.signal,
          outputType: this.outputFormat,
        });
      case 'line':
        return this.gstService.verticalCrossSection({
          coords,
          signal: this.abortController.signal,
          outputType: this.outputFormat,
        });
      case 'rectangle':
        return this.gstService.horizontalCrossSection({
          coords,
          signal: this.abortController.signal,
          outputType: this.outputFormat,
          depth: this.depth[geom.id!],
        });
      case 'polygon':
        throw new Error(`unsupported geometry type '${geom.type}'`);
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
                 .value=${parseFloat(this.depth[geom.id]).toFixed(1)}
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
      </ngm-geometries-list>`;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
