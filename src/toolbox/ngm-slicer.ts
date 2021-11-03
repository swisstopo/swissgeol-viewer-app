import {customElement, html, state} from 'lit-element';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import {syncSliceParam} from '../permalink';
import $ from '../jquery';
import 'fomantic-ui-css/components/checkbox';
import SlicerStore from '../store/slicer';
import {getMeasurements} from '../cesiumutils';
import Slicer from '../slicer/Slicer';
import {classMap} from 'lit-html/directives/class-map.js';
import {NgmGeometry} from './ngm-aoi-drawer';

@customElement('ngm-slicer')
export class NgmSlicer extends LitElementI18n {
  @state() slicer: Slicer | null = null
  @state() showBox = true
  @state() showBoxCheckbox;
  @state() negateSlice = false


  constructor() {
    super();
    SlicerStore.slicer.subscribe(slicer => {
      this.slicer = slicer;
    });
  }

  update(changedProperties) {
    // todo do not change position
    if (changedProperties.get('negateSlice') !== undefined) {
      this.toggleSlicer(this.slicingType);
    }

    super.update(changedProperties);
  }

  updated() {
    if (this.slicer && !this.showBoxCheckbox) {
      if (this.slicer.active && this.slicingType === 'view-box')
        this.showBox = this.slicer.sliceOptions.showBox!;
      this.showBoxCheckbox = $(this.querySelector('.ui.checkbox')).checkbox(this.showBox ? 'check' : 'uncheck');
    }
  }

  toggleSlicer(type?) {
    if (!this.slicer) return;
    const active = this.slicer.active;
    const boxOptionChanged = true; //this.slicingType !== type;
    this.slicer.active = false;
    if (!type) return;
    if (!active || boxOptionChanged) {
      this.slicer.sliceOptions = {
        type: type,
        showBox: this.showBox,
        negate: this.negateSlice,
        deactivationCallback: () => this.onDeactivation(),
        syncBoxPlanesCallback: (sliceInfo) => syncSliceParam(sliceInfo)
      };
      if (type === 'view-line') {
        this.slicer.sliceOptions.activationCallback = () => syncSliceParam({
          type: type,
          negate: this.negateSlice,
          slicePoints: this.slicer!.sliceOptions.slicePoints
        });
      }
      this.slicer.active = true;
    }
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

  addCurrentBoxToToolbox() {
    const bbox = this.slicer!.slicingBox.bbox!;
    const positions = [
      bbox.corners.bottomRight,
      bbox.corners.bottomLeft,
      bbox.corners.topLeft,
      bbox.corners.topRight
    ];
    const type = 'rectangle';
    SlicerStore.setRectangleToCreate({
      type: type,
      positions: positions,
      volumeHeightLimits: {
        height: bbox.height,
        lowerLimit: bbox.lowerLimit - bbox.altitude
      },
      volumeShowed: true,
      showSlicingBox: this.showBox,
      ...getMeasurements(positions, type)
    });
    this.slicer!.active = false;
  }

  onShowBoxChange(event) {
    this.showBox = event.target.checked;
    this.slicer!.toggleBoxVisibility(this.showBox);
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
          <div class="ngm-slice-options" ?hidden=${this.slicingType !== 'view-box'}>
            <div class="ngm-slice-type-label">${i18next.t('tbx_slicing_type')}</div>
            <div class="ngm-slice-side">
              <div class=${classMap({active: !this.negateSlice})} @click=${() => this.negateSlice = false}>
                <div class="ngm-out-box-icon"></div>
                ${i18next.t('tbx_slice_outside_label')}
              </div>
              <div class=${classMap({active: this.negateSlice})} @click=${() => this.negateSlice = true}>
                <div class="ngm-in-box-icon"></div>
                ${i18next.t('tbx_slice_inside_label')}
              </div>
            </div>
            <div class="ngm-checkbox ngm-slice-box-toggle ${classMap({active: this.showBox})}"
                 @click=${() => (<HTMLInputElement> this.querySelector('.ngm-slice-box-toggle > input')).click()}>
              <input type="checkbox" ?checked=${this.showBox} @change="${this.onShowBoxChange}">
              <span class="ngm-checkbox-icon">
              </span>
              <label>${i18next.t('nav_box_show_slice_box')}</label>
            </div>
            <div class="ngm-slice-to-draw">
              ${i18next.t('tbx_slice_geom_transform_hint')}
              <button class="ui button ngm-transform-btn" @click="${this.addCurrentBoxToToolbox}">
                ${i18next.t('tbx_slice_transform_btn')}
              </button>
            </div>
          </div>
        </div>
        <div class="ngm-slice-item ${classMap({active: this.slicingType === 'view-line'})}">
          <div class="ngm-slice-label" @click=${() => this.toggleSlicer('view-line')}>
            ${i18next.t('tbx_slice_line')}
          </div>
          <div class="ngm-slice-options" ?hidden=${this.slicingType !== 'view-line'}>

          </div>
        </div>
      </div>
      <div class="ngm-divider"></div>
      <ngm-geometries-list
        @geomclick=${(evt: CustomEvent<NgmGeometry>) => {
        }}>
      </ngm-geometries-list>
    `;
  }


  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
