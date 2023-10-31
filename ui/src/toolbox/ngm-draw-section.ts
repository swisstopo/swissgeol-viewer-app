import {LitElementI18n} from '../i18n';
import {customElement, property, state} from 'lit/decorators.js';
import type {PropertyValues} from 'lit';
import {html} from 'lit';
import i18next from 'i18next';
import {classMap} from 'lit-html/directives/class-map.js';
import ToolboxStore from '../store/toolbox';
import type {GeometryTypes} from './interfaces';
import {clickOnElement} from '../utils';
import DrawStore from '../store/draw';
import type {CesiumDraw} from '../draw/CesiumDraw';
import {Subscription} from 'rxjs';

const fileUploadInputId = 'fileUpload';

@customElement('ngm-draw-section')
export class NgmDrawSection extends LitElementI18n {
  // show all draw types if undefined or passed types
  @property({type: Array})
  accessor enabledTypes: GeometryTypes[] | undefined;
  @property({type: Boolean})
  accessor showUpload = true;
  @property({type: Boolean})
  accessor hidden = true;
  @state()
  accessor lineInfo = DrawStore.lineInfo.value;
  private draw: CesiumDraw | undefined;
  private drawGeometries = [
    {label: () => i18next.t('tbx_add_point_btn_label'), type: 'point', icon: 'ngm-point-draw-icon'},
    {label: () => i18next.t('tbx_add_line_btn_label'), type: 'line', icon: 'ngm-line-draw-icon'},
    {label: () => i18next.t('tbx_add_polygon_area_btn_label'), type: 'polygon', icon: 'ngm-polygon-draw-icon'},
    {label: () => i18next.t('tbx_add_rect_area_btn_label'), type: 'rectangle', icon: 'ngm-rectangle-draw-icon'},
  ];
  private shownDrawTypes = this.drawGeometries;
  private lineInfoSubscription: Subscription | undefined;


  constructor() {
    super();
    DrawStore.draw.subscribe(draw => {
      this.draw = draw;
      if (draw) draw.addEventListener('statechanged', () => this.requestUpdate());
    });
  }

  connectedCallback() {
    this.lineInfoSubscription =
        DrawStore.lineInfo.subscribe(value => this.lineInfo = value);
    super.connectedCallback();
  }

  disconnectedCallback() {
    this.lineInfoSubscription?.unsubscribe();
    super.disconnectedCallback();
  }

  update(changedProperties: PropertyValues) {
    if (changedProperties.has('enabledTypes') && this.enabledTypes) {
      this.shownDrawTypes = this.drawGeometries.filter(geom => this.enabledTypes!.includes(<GeometryTypes>geom.type));
    }
    if (this.draw && changedProperties.has('hidden') && !changedProperties.get('hidden')) {
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
    const disabled = !!(this.draw!.active && this.draw!.entityForEdit);
    return html`
      <div class="ngm-draw-list">
        ${this.shownDrawTypes.map(it => {
          const active = !disabled && this.draw!.active && it.type === this.draw!.type;
          return html`
            <div
                class="ngm-action-list-item ${classMap({active, disabled})}"
                @click=${() =>
                    ToolboxStore.nextGeometryAction({type: <GeometryTypes>it.type, action: 'add'})}>
              <div class="ngm-action-list-item-header">
                <div class=${it.icon}></div>
                <div>${it.label()}</div>
              </div>
              <div ?hidden=${!active} class="ngm-draw-hint">
                ${i18next.t('tbx_area_of_interest_add_hint')}
                <div class="ngm-info-icon"></div>
              </div>
              <div class="ngm-geom-info-content" .hidden="${!active || it.type !== 'line'}">
                        <div>
                            <div class="ngm-geom-info-label">
                                ${i18next.t('obj_info_length_label')}
                            </div>
                            <div class="ngm-geom-info-value">${this.lineInfo.lengthLabel}</div>
                        </div>
                        <div>
                            <div class="ngm-geom-info-label">${i18next.t('obj_info_number_segments_label')}</div>
                            <div class="ngm-geom-info-value">${this.lineInfo.segments}</div>
                        </div>
                    </div>
            </div>`;
        })}
        <div .hidden=${!this.showUpload} class="ngm-action-list-item ${classMap({disabled})}"
             @click=${() => clickOnElement(fileUploadInputId)}>
          <div class="ngm-action-list-item-header">
            <div class="ngm-file-upload-icon"></div>
            <div>${i18next.t('tbx_upload_btn_label')}</div>
          </div>
        </div>
      </div>
      <input id="${fileUploadInputId}" type='file' accept=".kml,.KML,.gpx,.GPX" hidden
             @change=${evt => this.uploadFile(evt)}/>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
