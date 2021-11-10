import {LitElementI18n} from '../i18n';
import {html, TemplateResult} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import i18next from 'i18next';
import ToolboxStore from '../store/toolbox';
import {classMap} from 'lit-html/directives/class-map.js';
import {NgmGeometry} from './interfaces';
import $ from '../jquery';

@customElement('ngm-geometries-list')
export default class NgmGeometriesList extends LitElementI18n {
  @property({type: String}) selectedId = '';
  @property({type: Function}) optionsTemplate: ((geom: NgmGeometry) => TemplateResult) | undefined;
  @property({type: Array}) disabledTypes: string[] = [];
  @state() geometries: NgmGeometry[] = [];

  constructor() {
    super();
    ToolboxStore.geometries.subscribe(geoms => {
      this.geometries = geoms;
    });
  }

  firstUpdated() {
    $(this.querySelector('.ui.dropdown')).dropdown();
  }

  actionMenuTemplate(id) {
    return html`
      <div class="menu">
        <div class="item"
             @click=${() => {
             }}>
          ${i18next.t('tbx_fly_to_btn_hint')}
        </div>
        <div class="item"
             @click=${() => ToolboxStore.setGeometryId(id)}>
          ${i18next.t('tbx_info_btn')}
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="ngm-geom-label">${i18next.t('tbx_my_geometries')}</div>
      <div class="ngm-geom-list">
        ${this.geometries.map((i) => {
          const disabled = this.disabledTypes.includes(i.type);
          const active = !disabled && this.selectedId === i.id;
          return html`
            <div class="ngm-geom-item ${classMap({active, disabled})}">
              <div class="ngm-geom-header">
                <div
                  @click=${() => !disabled && this.dispatchEvent(new CustomEvent('geomclick', {detail: i}))}>
                  ${i.name}
                </div>
                <div class="ui dropdown right pointing ngm-action-menu">
                  <div class="ngm-action-menu-icon"></div>
                  ${this.actionMenuTemplate(i.id)}
                </div>
              </div>
              ${this.optionsTemplate ? this.optionsTemplate(i) : ''}
            </div>
          `;
        })}
      </div>`;
  }

  createRenderRoot() {
    return this;
  }

}
