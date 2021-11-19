import {LitElementI18n} from '../i18n';
import {html, TemplateResult} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import i18next from 'i18next';
import ToolboxStore from '../store/toolbox';
import {classMap} from 'lit-html/directives/class-map.js';
import {GeometryTypes, NgmGeometry} from './interfaces';
import $ from '../jquery.js';

@customElement('ngm-geometries-list')
export default class NgmGeometriesList extends LitElementI18n {
  @property({type: String}) selectedId = '';
  @property({type: Function}) optionsTemplate: ((geom: NgmGeometry) => TemplateResult) | undefined;
  @property({type: Array}) disabledTypes: string[] = [];
  @state() geometries: NgmGeometry[] = [];
  @state() editingEnabled = false;
  @state() selectedFilter: GeometryTypes | undefined;

  constructor() {
    super();
    ToolboxStore.geometries.subscribe(geoms => {
      this.geometries = geoms;
    });
    ToolboxStore.openedGeometryOptions.subscribe(options => this.editingEnabled = !!(options?.editing));
  }

  protected firstUpdated() {
    this.querySelectorAll('.ngm-action-menu').forEach(el => $(el).dropdown());
  }

  updated(changedProperties) {
    if (changedProperties.get('geometries'))
      this.querySelectorAll('.ngm-action-menu').forEach(el => $(el).dropdown());

    super.updated(changedProperties);
  }

  selectFilter(type?: GeometryTypes) {
    if (type === this.selectedFilter) {
      this.selectedFilter = undefined;
      return;
    }
    this.selectedFilter = type;
  }

  actionMenuTemplate(geom: NgmGeometry) {
    return html`
      <div class="menu">
        <div class="item"
             @click=${() => ToolboxStore.nextGeometryAction({id: geom.id!, action: 'zoom'})}>
          ${i18next.t('tbx_fly_to_btn_hint')}
        </div>
        <div class="item"
             @click=${() => ToolboxStore.setOpenedGeometryOptions({id: geom.id!})}>
          ${i18next.t('tbx_info_btn')}
        </div>
        <div class="item"
             @click=${() => ToolboxStore.setOpenedGeometryOptions({id: geom.id!, editing: true})}>
          ${i18next.t('tbx_edit_btn')}
        </div>
        <div class="item"
             @click=${() => ToolboxStore.nextGeometryAction({id: geom.id!, action: 'copy'})}>
          ${i18next.t('tbx_copy_btn')}
        </div>
        <div class="item"
             @click=${() => ToolboxStore.nextGeometryAction({id: geom.id!, action: geom.show ? 'hide' : 'show'})}>
          ${geom.show ? i18next.t('tbx_hide_btn_label') : i18next.t('tbx_unhide_btn_label')}
        </div>
        <div class="item"
             @click=${() => ToolboxStore.nextGeometryAction({id: geom.id!, action: 'remove'})}>
          ${i18next.t('tbx_remove_btn_label')}
        </div>
      </div>
    `;
  }

  filterMenuTemplate() {
    return html`
      <div class="menu">
        <div class="item"
             @click=${() => ToolboxStore.nextGeometryAction({type: this.selectedFilter, action: 'showAll'})}>
          ${i18next.t('tbx_show_all_btn')}
        </div>
        <div class="item"
             @click=${() => ToolboxStore.nextGeometryAction({type: this.selectedFilter, action: 'hideAll'})}>
          ${i18next.t('tbx_hide_all_btn')}
        </div>
      </div>
    `;
  }

  render() {
    const geometries = this.selectedFilter ? this.geometries.filter(geom => geom.type === this.selectedFilter) : this.geometries;
    return html`
      <div class="ngm-geom-label">${i18next.t('tbx_my_geometries')}</div>
      <div class="ngm-geom-list">
        <div class="ngm-action-list-item ngm-geom-filter">
          <div class="ngm-action-list-item-header">
            <div class=${classMap({active: !this.selectedFilter})} @click=${() => this.selectFilter()}>
              ${i18next.t('tbx_all_label')}
            </div>
            <div class="ngm-point-draw-icon ${classMap({active: this.selectedFilter === 'point'})}"
                 @click=${() => this.selectFilter('point')}>
            </div>
            <div class="ngm-line-draw-icon ${classMap({active: this.selectedFilter === 'line'})}"
                 @click=${() => this.selectFilter('line')}>
            </div>
            <div class="ngm-polygon-draw-icon ${classMap({active: this.selectedFilter === 'polygon'})}"
                 @click=${() => this.selectFilter('polygon')}>
            </div>
            <div class="ngm-rectangle-draw-icon ${classMap({active: this.selectedFilter === 'rectangle'})}"
                 @click=${() => this.selectFilter('rectangle')}>
            </div>
            <div class="ui dropdown right pointing ngm-action-menu">
              <div class="ngm-action-menu-icon"></div>
              ${this.filterMenuTemplate()}
            </div>
          </div>
        </div>
      </div>
      ${geometries.map((i) => {
        const disabled = this.disabledTypes.includes(i.type) || this.editingEnabled;
        const active = !disabled && this.selectedId === i.id;
        const hidden = !disabled && !active && !i.show;
        return html`
          <div class="ngm-action-list-item ${classMap({active, disabled, hidden})}">
            <div class="ngm-action-list-item-header">
              <div
                @click=${() => !disabled && this.dispatchEvent(new CustomEvent('geomclick', {detail: i}))}>
                ${i.name}
              </div>
              <div class="ui dropdown right pointing ngm-action-menu">
                <div class="ngm-action-menu-icon"></div>
                ${this.actionMenuTemplate(i)}
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
