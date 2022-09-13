import {LitElementI18n} from '../i18n';
import type {TemplateResult} from 'lit';
import {html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import i18next from 'i18next';
import ToolboxStore from '../store/toolbox';
import {classMap} from 'lit-html/directives/class-map.js';
import type {GeometryTypes, NgmGeometry} from './interfaces';
import $ from '../jquery.js';

@customElement('ngm-geometries-list')
export default class NgmGeometriesList extends LitElementI18n {
  @property({type: String}) selectedId = '';
  @property({type: String}) title = i18next.t('tbx_my_geometries');
  @property({type: Function}) geometryFilter: (geom: NgmGeometry) => boolean = (geom) => !geom.fromTopic;
  @property({type: Function}) optionsTemplate: ((geom: NgmGeometry, active: boolean) => TemplateResult) | undefined;
  @property({type: Array}) disabledTypes: string[] = [];
  @property({type: Function}) disabledCallback: ((geom: NgmGeometry) => boolean) | undefined;
  @state() geometries: NgmGeometry[] = [];
  @state() editingEnabled = false;
  @state() selectedFilter: GeometryTypes | undefined;
  private scrollDown = false;

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
    const geoms = changedProperties.get('geometries');
    if (geoms || changedProperties.get('selectedFilter')) {
      this.querySelectorAll('.ngm-action-menu').forEach(el => $(el).dropdown());
    }

    if (this.scrollDown) {
      this.parentElement!.scrollTop = this.parentElement!.scrollHeight;
      this.scrollDown = false;
    }

    if (geoms && geoms.length < this.geometries.length) {
      const newGeometries = this.geometries.filter(leftValue => !geoms.some(rightValue => leftValue.id === rightValue.id));
      if (newGeometries.length) {
        this.selectedFilter = undefined;
        this.scrollDown = true;
      }
      this.dispatchEvent(new CustomEvent('geometriesadded', {detail: {newGeometries}}));
    }

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
        <div class="item ${classMap({'disabled': !geom.editable})}"
             @click=${() => ToolboxStore.setOpenedGeometryOptions({id: geom.id!, editing: true})}>
          ${i18next.t('tbx_edit_btn')}
        </div>
        <div class="item ${classMap({'disabled': !geom.copyable})}"
             @click=${() => ToolboxStore.nextGeometryAction({id: geom.id!, action: 'copy'})}>
          ${i18next.t('tbx_copy_btn')}
        </div>
        ${(geom.type === 'line') ? html`
          <div class="item"
               @click=${() => ToolboxStore.nextGeometryAction({id: geom.id!, action: 'profile'})}>
            ${i18next.t('tbx_profile_btn')}
          </div>` : html``}
        <div class="item"
             @click=${() => ToolboxStore.nextGeometryAction({id: geom.id!, action: geom.show ? 'hide' : 'show'})}>
          ${geom.show ? i18next.t('tbx_hide_btn_label') : i18next.t('tbx_unhide_btn_label')}
        </div>
        <div class="item ${classMap({'disabled': !geom.editable})}"
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
        <div class="item"
             @click=${() => ToolboxStore.nextGeometryAction({type: this.selectedFilter, action: 'downloadAll'})}>
          ${i18next.t('tbx_download_all_btn')}
        </div>
      </div>
    `;
  }

  render() {
    const geometries = this.selectedFilter ? this.geometries.filter(this.geometryFilter).filter(geom => geom.type === this.selectedFilter) : this.geometries.filter(this.geometryFilter);

    if (!geometries.length && !this.selectedFilter) {
      return html``;
    }
    return html`
      <div class="ngm-geom-label">${this.title}</div>
      <div class="ngm-geom-list">
        <div class="ngm-action-list-item ngm-geom-filter">
          <div class="ngm-action-list-item-header">
            <div class=${classMap({active: !this.selectedFilter})} @click=${() => this.selectFilter()}>
              ${i18next.t('tbx_all_label')}
            </div>
            <div class="ngm-point-draw-icon ${classMap({active: this.selectedFilter === 'point'})}"
                 title=${i18next.t('tbx_filter_point')}
                 @click=${() => this.selectFilter('point')}>
            </div>
            <div class="ngm-line-draw-icon ${classMap({active: this.selectedFilter === 'line'})}"
                 title=${i18next.t('tbx_filter_line')}
                 @click=${() => this.selectFilter('line')}>
            </div>
            <div class="ngm-polygon-draw-icon ${classMap({active: this.selectedFilter === 'polygon'})}"
                 title=${i18next.t('tbx_filter_polygon')}
                 @click=${() => this.selectFilter('polygon')}>
            </div>
            <div class="ngm-rectangle-draw-icon ${classMap({active: this.selectedFilter === 'rectangle'})}"
                 title=${i18next.t('tbx_filter_rectangle')}
                 @click=${() => this.selectFilter('rectangle')}>
            </div>
            <div class="ui dropdown right pointing ngm-action-menu">
              <div class="ngm-action-menu-icon"></div>
              ${this.filterMenuTemplate()}
            </div>
          </div>
        </div>
        ${geometries.map((i) => {
          const disabled = (this.disabledCallback && this.disabledCallback(i)) || this.disabledTypes.includes(i.type) || this.editingEnabled;
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
              ${this.optionsTemplate ? this.optionsTemplate(i, active) : ''}
            </div>
          `;
        })}
      </div>
      </div>`;
  }

  createRenderRoot() {
    return this;
  }

}
