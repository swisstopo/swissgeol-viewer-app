import {html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import {getSliceParam, syncSliceParam} from '../permalink';
import 'fomantic-ui-css/components/checkbox';
import ToolboxStore from '../store/toolbox';
import {getMeasurements, isGeometryInViewport} from '../cesiumutils';
import type Slicer from '../slicer/Slicer';
import {classMap} from 'lit-html/directives/class-map.js';
import type SlicingBox from '../slicer/SlicingBox';
import type {BBox} from '../slicer/helper';
import type {Cartesian3, CustomDataSource} from 'cesium';
import type {NgmGeometry} from './interfaces';
import {flyToGeom, hideVolume, updateEntityVolume} from './helpers';
import MainStore from '../store/main';
import {skip} from 'rxjs';
import DrawStore from '../store/draw';
import NavToolsStore from '../store/navTools';

@customElement('ngm-slicer')
export class NgmSlicer extends LitElementI18n {
  @property({type: Object}) geometriesDataSource: CustomDataSource | undefined;
  @property({type: Boolean}) hidden = true;
  @state() slicer: Slicer | null = null;
  @state() showBox = true;
  @state() negateSlice = false;
  @state() editingEnabled = false;
  private sliceGeomId: string | undefined;
  private sliceInfo: { slicePoints: Cartesian3[], height?: number, lowerLimit?: number } | undefined;


  constructor() {
    super();
    ToolboxStore.slicer.subscribe(slicer => {
      if (!slicer) return;
      this.slicer = slicer;
      this.slicer.draw.addEventListener('statechanged', evt => {
        DrawStore.setDrawState((<CustomEvent>evt).detail.active);
        this.requestUpdate();
      });
      this.syncSlice();
    });
    ToolboxStore.sliceGeometry.pipe(skip(1)).subscribe(geom => this.toggleGeomSlicer(geom));
    ToolboxStore.openedGeometryOptions.subscribe(options => {
      this.editingEnabled = !!(options?.editing);
      if (this.editingEnabled && (this.slicer?.active || this.slicer?.draw.active))
        this.toggleSlicer();
    });
    ToolboxStore.syncSlice.subscribe(() => this.syncSlice());
  }

  protected update(changedProperties) {
    if (changedProperties.get('hidden') && !this.hidden && !this.slicer?.active && !this.editingEnabled)
      this.toggleSlicer('view-line');
    super.update(changedProperties);
  }

  syncSlice() {
    const sliceOptions = getSliceParam();
    if (sliceOptions && sliceOptions.type && sliceOptions.slicePoints) {
      this.showBox = sliceOptions.showBox;
      this.negateSlice = sliceOptions.negate;
      this.toggleSlicer(sliceOptions.type, sliceOptions, true);
    } else if (this.slicingEnabled) {
      this.toggleSlicer();
    }
  }

  toggleSlicer(type?, info?, force?) {
    if (!this.slicer) return;
    const active = this.slicer.active;
    const sliceOptionChanged = this.slicingType !== type;
    this.slicer.active = false;
    if (!type) return;
    if (force || !active || sliceOptionChanged) {
      this.slicer.sliceOptions = {
        type: type,
        showBox: this.showBox,
        negate: this.negateSlice,
        slicePoints: info?.slicePoints,
        lowerLimit: info?.lowerLimit,
        height: info?.height,
        deactivationCallback: () => this.onDeactivation(),
        syncBoxPlanesCallback: (sliceInfo) => this.syncSliceInfo(sliceInfo)
      };
      if (type === 'view-line') {
        this.slicer.sliceOptions.activationCallback = () => this.syncSliceInfo({
          type: type,
          negate: this.negateSlice,
          slicePoints: this.slicer!.sliceOptions.slicePoints
        });
      }
      this.sliceInfo = undefined;
      this.slicer.active = true;
    }
    this.requestUpdate();
  }

  syncSliceInfo(sliceInfo) {
    syncSliceParam(sliceInfo);
    this.sliceInfo = sliceInfo;
  }

  toggleGeomSlicer(geom: NgmGeometry | null | undefined) {
    if (!this.slicer) return;
    const active = this.slicer.active;
    if (geom && (!active || (active && this.sliceGeomId !== geom.id))) {
      this.slicer.active = false;
      if (geom.type === 'line') {
        this.slicer.sliceOptions = {
          type: 'line',
          slicePoints: [geom.positions[0], geom.positions[geom.positions.length - 1]],
          negate: this.negateSlice,
          deactivationCallback: () => this.onGeomSliceDeactivation(geom),
          activationCallback: () => this.syncSliceInfo({
            type: 'view-line',
            negate: this.negateSlice,
            slicePoints: this.slicer!.sliceOptions.slicePoints
          })
        };
      } else {
        this.slicer.sliceOptions = {
          type: 'box',
          slicePoints: geom.positions,
          lowerLimit: geom.volumeHeightLimits?.lowerLimit,
          height: geom.volumeHeightLimits?.height,
          negate: this.negateSlice,
          showBox: this.showBox,
          deactivationCallback: () => this.onGeomSliceDeactivation(geom),
          syncBoxPlanesCallback: (sliceInfo) => this.syncSliceInfo({...sliceInfo, type: 'view-box'})
        };
      }
      const entity = this.geometriesDataSource!.entities.getById(geom.id!);
      !isGeometryInViewport(MainStore.viewerValue!, geom.positions) && this.flyToSlicingGeom(entity);
      entity!.show = false;
      this.sliceGeomId = geom.id;
      this.slicer.active = true;
    } else {
      this.slicer.active = false;
    }
    this.requestUpdate();
  }

  onGeomSliceDeactivation(geom: NgmGeometry) {
    let positions: Cartesian3[] | undefined;
    let lowerLimit: number | undefined;
    let height: number | undefined;
    if (geom.type === 'rectangle') {
      const bbox: BBox = (<SlicingBox> this.slicer!.slicingTool).bbox!;
      const bboxCorners = bbox.corners;
      height = bbox.height;
      lowerLimit = bbox.lowerLimit - bbox.altitude;
      positions = [bboxCorners.bottomLeft, bboxCorners.bottomRight, bboxCorners.topRight, bboxCorners.topLeft];
    }
    this.sliceGeomId = undefined;
    const entity = this.geometriesDataSource!.entities.getById(geom.id!);
    if (!entity) return;
    if (geom.type === 'rectangle') {
      entity.polygon!.hierarchy = <any>{positions};
      entity.properties!.volumeHeightLimits = {lowerLimit, height};
      updateEntityVolume(entity, MainStore.viewerValue!.scene.globe);
      hideVolume(entity);
    }
    entity.show = true;
    syncSliceParam();
    this.requestUpdate();
  }

  onDeactivation() {
    syncSliceParam();
    this.requestUpdate();
  }

  get slicingType() {
    return this.slicer!.sliceOptions.type;
  }

  get slicingEnabled() {
    return this.slicer!.active || this.slicer!.draw.active;
  }

  addCurrentSliceToToolbox(sliceType) {
    const type = sliceType === 'view-box' ? 'rectangle' : 'line';
    let positions = this.sliceInfo!.slicePoints;
    let geomToCreate: NgmGeometry = {type: type, positions: positions};
    if (type === 'rectangle') {
      const bbox = this.slicer!.slicingBox.bbox!;
      positions = [bbox.corners.bottomRight, bbox.corners.bottomLeft, bbox.corners.topLeft, bbox.corners.topRight];
      geomToCreate = {
        ...geomToCreate,
        positions: positions,
        volumeShowed: true,
        showSlicingBox: this.showBox,
        volumeHeightLimits: {
          height: this.sliceInfo!.height!,
          lowerLimit: this.sliceInfo!.lowerLimit!
        }
      };
    }
    geomToCreate = {...geomToCreate, ...getMeasurements(positions, type)};
    ToolboxStore.setGeometryToCreate(geomToCreate);
    this.slicer!.active = false;
  }

  onShowBoxChange(event) {
    this.showBox = event.target.checked;
    this.slicer!.toggleBoxVisibility(this.showBox);
    if (this.sliceGeomId) {
      const entity = this.geometriesDataSource!.entities.getById(this.sliceGeomId)!;
      entity.properties!.showSlicingBox = this.showBox;
    }
  }

  changeSliceSide(negate, geom) {
    this.negateSlice = negate;
    const type = this.slicer!.sliceOptions.type;
    this.slicer!.active = false;
    geom ? this.toggleGeomSlicer(geom) : this.toggleSlicer(type, this.sliceInfo);
  }

  flyToSlicingGeom(entity) {
    NavToolsStore.hideTargetPoint();
    const scene = MainStore.viewerValue!.scene;
    flyToGeom(scene, entity, -(Math.PI / 4), 2);
  }

  get sceneSlicingActive() {
    return (this.slicer?.active && !this.sliceGeomId) || this.slicer?.draw.active;
  }

  sliceOptionsTemplate(options) {
    let id, type = options.type;
    if (options.geom) {
      id = options.geom.id;
      type = options.geom.type === 'line' ? 'line' : 'box';
    }
    return html`
      <div class="ngm-draw-hint"
           ?hidden=${(!id && this.slicingType !== type) || id !== this.sliceGeomId || !this.slicer!.draw.active}>
        ${i18next.t('tbx_slice_draw_hint')}
        <div class="ngm-info-icon"></div>
      </div>
      <div class="ngm-slice-options"
           ?hidden=${(!id && this.slicingType !== type) || id !== this.sliceGeomId || this.slicer!.draw.active}>
        <div class="ngm-slice-type-label">${i18next.t('tbx_slicing_type')}</div>
        <div class="ngm-slice-side">
          <div class=${classMap({active: !this.negateSlice})}
               @click=${() => this.changeSliceSide(false, options.geom)}>
            <div class=${type.includes('box') ? 'ngm-out-box-icon' : 'ngm-slice-left-icon'}></div>
            ${type.includes('box') ? i18next.t('tbx_slice_outside_label') : i18next.t('tbx_slice_left_label')}
          </div>
          <div class=${classMap({active: this.negateSlice})}
               @click=${() => this.changeSliceSide(true, options.geom)}>
            <div class=${type.includes('box') ? 'ngm-in-box-icon' : 'ngm-slice-right-icon'}></div>
            ${type.includes('box') ? i18next.t('tbx_slice_inside_label') : i18next.t('tbx_slice_right_label')}
          </div>
        </div>
        <div ?hidden=${type.includes('line')}
             class="ngm-checkbox ngm-slice-box-toggle ${classMap({active: this.showBox})}"
             @click=${() => (<HTMLInputElement> this.querySelector('.ngm-slice-box-toggle > input')).click()}>
          <input type="checkbox" ?checked=${this.showBox} @change="${this.onShowBoxChange}">
          <span class="ngm-checkbox-icon">
              </span>
          <label>${i18next.t('nav_box_show_slice_box')}</label>
        </div>
        <div class="ngm-slice-to-draw" ?hidden=${!!options.geom}>
          ${i18next.t('tbx_slice_geom_transform_hint')}
          <button class="ui button ngm-transform-btn" @click=${() => this.addCurrentSliceToToolbox(type)}>
            ${i18next.t('tbx_slice_transform_btn')}
          </button>
        </div>
      </div>
    `;
  }

  render() {
    if (!this.slicer) return '';
    return html`
      <div class="ngm-slice-types ${classMap({disabled: this.editingEnabled})}">
        <div class="ngm-action-list-item ${classMap({active: this.slicingType === 'view-box'})}">
          <div class="ngm-action-list-item-header" @click=${() => this.toggleSlicer('view-box')}>
            <div>${i18next.t('tbx_slice_box')}</div>
          </div>
          ${this.sliceOptionsTemplate({type: 'view-box'})}
        </div>
        <div class="ngm-action-list-item ${classMap({active: this.slicingType === 'view-line'})}">
          <div class="ngm-action-list-item-header" @click=${() => this.toggleSlicer('view-line')}>
            <div>${i18next.t('tbx_slice_line')}</div>
          </div>
          ${this.sliceOptionsTemplate({type: 'view-line'})}
        </div>
      </div>
      <div class="ngm-divider"></div>
      <ngm-geometries-list
        .selectedId=${this.sliceGeomId}
        .disabledTypes=${['point', 'polygon']}
        .optionsTemplate=${(geom) => this.sliceOptionsTemplate({geom})}
        @geomclick=${(evt: CustomEvent<NgmGeometry>) => ToolboxStore.setSliceGeometry(evt.detail)}>
      </ngm-geometries-list>
      <ngm-geometries-list
        title=${i18next.t('tbx_geometries_from_topic')}
        .disabledTypes=${['point', 'polygon']}
        .geometryFilter=${(geom: NgmGeometry) => geom.fromTopic}
      ></ngm-geometries-list>
    `;
  }


  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
