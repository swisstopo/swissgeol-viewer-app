import {html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import {getSliceParam, syncSliceParam} from '../permalink';
import 'fomantic-ui-css/components/checkbox';
import ToolboxStore from '../store/toolbox';
import {getMeasurements} from '../cesiumutils';
import Slicer from '../slicer/Slicer';
import {classMap} from 'lit-html/directives/class-map.js';
import SlicingBox from '../slicer/SlicingBox';
import {BBox} from '../slicer/helper';
import {Cartesian3, JulianDate} from 'cesium';
import {NgmGeometry} from './interfaces';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import {updateEntityVolume} from './helpers';
import MainStore from '../store/main';

@customElement('ngm-slicer')
export class NgmSlicer extends LitElementI18n {
  @property({type: Object}) geometriesDataSource: CustomDataSource | undefined;
  @state() slicer: Slicer | null = null;
  @state() showBox = true;
  @state() negateSlice = false;
  private sliceGeomId: string | undefined;
  private julianDate = new JulianDate();
  private sliceInfo: { slicePoints: Cartesian3[], height?: number, lowerLimit?: number } | undefined;


  constructor() {
    super();
    ToolboxStore.slicer.subscribe(slicer => {
      if (!slicer) return;
      this.slicer = slicer;
      const sliceOptions = getSliceParam();
      if (sliceOptions && sliceOptions.type && sliceOptions.slicePoints) {
        this.showBox = sliceOptions.showBox;
        this.negateSlice = sliceOptions.negate;
        this.slicer!.sliceOptions = {
          ...this.slicer!.sliceOptions, ...sliceOptions,
          syncBoxPlanesCallback: (sliceInfo) => this.syncSliceInfo(sliceInfo),
          deactivationCallback: () => this.onDeactivation()
        };
        if (sliceOptions.type === 'view-line') {
          this.slicer.sliceOptions.activationCallback = () => this.syncSliceInfo(sliceOptions);
        }
        this.slicer!.active = true;
      }
    });
  }

  toggleSlicer(type?, info?) {
    if (!this.slicer) return;
    const active = this.slicer.active;
    const boxOptionChanged = this.slicingType !== type;
    this.slicer.active = false;
    if (!type) return;
    if (!active || boxOptionChanged) {
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

  toggleGeomSlicer(geom: NgmGeometry) {
    if (!this.slicer) return;
    const active = this.slicer.active;
    if (!active || (active && this.sliceGeomId !== geom.id)) {
      this.slicer.active = false;
      if (geom.type === 'line') {
        this.slicer.sliceOptions = {
          type: 'line',
          slicePoints: [geom.positions[0], geom.positions[geom.positions.length - 1]],
          negate: this.negateSlice,
          deactivationCallback: () => this.onGeomSliceDeactivation(geom)
        };
      } else {
        this.slicer.sliceOptions = {
          type: 'box',
          slicePoints: geom.positions,
          lowerLimit: geom.volumeHeightLimits?.lowerLimit,
          height: geom.volumeHeightLimits?.height,
          negate: this.negateSlice,
          showBox: this.showBox,
          deactivationCallback: () => this.onGeomSliceDeactivation(geom)
        };
      }
      const entity = this.geometriesDataSource!.entities.getById(geom.id!);
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
      updateEntityVolume(entity, this.julianDate, MainStore.viewerValue!.scene.globe);
    }
    entity.show = true;
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
    return this.slicer!.active;
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

  sliceOptionsTemplate(options) {
    let id, type = options.type;
    if (options.geom) {
      id = options.geom.id;
      type = options.geom.type === 'line' ? 'line' : 'box';
    }
    return html`
      <div class="ngm-slice-options" ?hidden=${(!id && this.slicingType !== type) || id !== this.sliceGeomId}>
        <div class="ngm-slice-type-label">${i18next.t('tbx_slicing_type')}</div>
        <div class="ngm-slice-side">
          <div class=${classMap({active: !this.negateSlice})}
               @click=${() => this.changeSliceSide(false, options.geom)}>
            <div class=${type.includes('box') ? 'ngm-out-box-icon' : 'ngm-slice-left-icon'}></div>
            ${i18next.t(type.includes('box') ? 'tbx_slice_outside_label' : 'tbx_slice_left_label')}
          </div>
          <div class=${classMap({active: this.negateSlice})}
               @click=${() => this.changeSliceSide(true, options.geom)}>
            <div class=${type.includes('box') ? 'ngm-in-box-icon' : 'ngm-slice-right-icon'}></div>
            ${i18next.t(type.includes('box') ? 'tbx_slice_inside_label' : 'tbx_slice_right_label')}
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
        <div class="ngm-slice-to-draw">
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
      <div class="ngm-slice-types">
        <div class="ngm-slice-item ${classMap({active: !this.slicingEnabled})}" @click=${() => this.toggleSlicer()}>
          <div class="ngm-slice-label">${i18next.t('tbx_disable_slice_btn_label')}</div>
        </div>
        <div class="ngm-slice-item ${classMap({active: this.slicingType === 'view-box'})}">
          <div class="ngm-slice-label" @click=${() => this.toggleSlicer('view-box')}>
            ${i18next.t('tbx_slice_box')}
          </div>
          ${this.sliceOptionsTemplate({type: 'view-box'})}
        </div>
        <div class="ngm-slice-item ${classMap({active: this.slicingType === 'view-line'})}">
          <div class="ngm-slice-label" @click=${() => this.toggleSlicer('view-line')}>
            ${i18next.t('tbx_slice_line')}
          </div>
          ${this.sliceOptionsTemplate({type: 'view-line'})}
        </div>
      </div>
      <div class="ngm-divider"></div>
      <ngm-geometries-list
        .selectedId=${this.sliceGeomId}
        .disabledTypes=${['point', 'polygon']}
        .optionsTemplate=${(geom) => this.sliceOptionsTemplate({geom})}
        @geomclick=${(evt: CustomEvent<NgmGeometry>) => this.toggleGeomSlicer(evt.detail)}>
      </ngm-geometries-list>
    `;
  }


  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
