import i18next from 'i18next';

import {html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n';
import type {CesiumDraw} from '../draw/CesiumDraw.js';


import {clickOnElement} from '../utils';
import './ngm-gst-interaction';
import {classMap} from 'lit-html/directives/class-map.js';
import './ngm-swissforages-modal';
import './ngm-swissforages-interaction';
import ToolboxStore from '../store/toolbox';
import type {GeometryTypes, NgmGeometry} from './interfaces';
import DrawStore from '../store/draw';

const fileUploadInputId = 'fileUpload';

@customElement('ngm-geometry-drawer')
export class NgmAreaOfInterestDrawer extends LitElementI18n {
  @property({type: Boolean}) drawerHidden = true;
  @state() selectedAreaId: string | undefined;
  private draw: CesiumDraw | undefined;
  private drawGeometries = [
    {label: () => i18next.t('tbx_add_point_btn_label'), type: 'point', icon: 'ngm-point-draw-icon'},
    {label: () => i18next.t('tbx_add_line_btn_label'), type: 'line', icon: 'ngm-line-draw-icon'},
    {label: () => i18next.t('tbx_add_polygon_area_btn_label'), type: 'polygon', icon: 'ngm-polygon-draw-icon'},
    {label: () => i18next.t('tbx_add_rect_area_btn_label'), type: 'rectangle', icon: 'ngm-rectangle-draw-icon'},
  ];

  constructor() {
    super();
    DrawStore.draw.subscribe(draw => {
      this.draw = draw;
      if (draw) draw.addEventListener('statechanged', () => this.requestUpdate());
    });
    ToolboxStore.openedGeometryOptions.subscribe(options => {
      this.selectedAreaId = options ? options.id : undefined;
    });
  }

  update(changedProperties) {
    if (changedProperties.has('drawerHidden') && !changedProperties.get('drawerHidden') && this.draw) {
      this.draw.active = false;
      this.draw.clear();
    }
    super.update(changedProperties);
  }

  private uploadFile(evt) {
    const file: File | null = evt.target ? evt.target.files[0] : null;
    evt.target.value = null;
    if (!file) return;
    ToolboxStore.nextGeometryAction({file: file, action: 'upload'});
  }

  render() {
    const disabled = this.draw!.active && this.draw!.entityForEdit;
    return html`
      <div class="ngm-draw-list">
        ${this.drawGeometries.map(it => {
          const active = !disabled && this.draw!.active && it.type === this.draw!.type;
          return html`
            <div
              class="ngm-draw-list-item ${classMap({active, disabled})}"
              @click=${() =>
                ToolboxStore.nextGeometryAction({type: <GeometryTypes>it.type, action: 'add'})}>
              <div class=${it.icon}></div>
              <div>${it.label()}</div>
            </div>
            <div ?hidden=${!active} class="ngm-draw-hint">
              ${i18next.t('tbx_area_of_interest_add_hint')}
              <div class="ngm-info-icon"></div>
            </div>`;
        })}
        <div class="ngm-draw-list-item ${classMap({disabled})}" @click=${() => clickOnElement(fileUploadInputId)}>
          <div class="ngm-file-upload-icon"></div>
          <div>${i18next.t('tbx_upload_btn_label')}</div>
        </div>
      </div>
      <input id="${fileUploadInputId}" type='file' accept=".kml,.KML,.gpx,.GPX" hidden
             @change=${evt => this.uploadFile(evt)}/>
      <div class="ngm-divider"></div>
      <ngm-geometries-list
        .selectedId=${this.selectedAreaId}
        @geomclick=${(evt: CustomEvent<NgmGeometry>) => {
          ToolboxStore.nextGeometryAction({id: evt.detail.id, action: 'zoom'});
          ToolboxStore.setOpenedGeometryOptions({id: evt.detail.id!});
        }}>
      </ngm-geometries-list>`;
  }

  createRenderRoot() {
    return this;
  }

}
