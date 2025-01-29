import { LitElementI18n } from '../i18n';
import type { PropertyValues, TemplateResult } from 'lit';
import { html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import i18next from 'i18next';
import ToolboxStore from '../store/toolbox';
import { classMap } from 'lit-html/directives/class-map.js';
import type { GeometryTypes, NgmGeometry } from './interfaces';
import $ from 'jquery';
import { NgmConfirmationModal } from '../elements/ngm-confirmation-modal';

@customElement('ngm-geometries-simple-list')
export default class NgmGeometriesSimpleList extends LitElementI18n {
  @property({ type: Array })
  accessor geometries: NgmGeometry[] = [];
  @property({ type: String })
  accessor selectedId = '';
  @property({ type: String })
  accessor listTitle: string | undefined;
  @property({ type: Object })
  accessor optionsTemplate:
    | ((geom: NgmGeometry, active: boolean) => TemplateResult)
    | undefined;
  @property({ type: Array })
  accessor disabledTypes: string[] = [];
  @property({ type: Object })
  accessor disabledCallback: ((geom: NgmGeometry) => boolean) | undefined;
  // in noEdit mode, editing of geometries will be disabled but it will be possible to interact with geometries on map
  @property({ type: Boolean })
  accessor noEditMode = false;
  // in view mode any actions with geometry will be disabled
  @property({ type: Boolean })
  accessor viewMode = false;
  // hides zoomTo, info, edit buttons from context menu
  @property({ type: Boolean })
  accessor hideMapInteractionButtons = false;
  // allows to edit geometry name directly in the list
  @property({ type: Boolean })
  accessor directNameEdit = false;
  @property({ type: Boolean })
  accessor editingEnabled = false;
  @state()
  accessor selectedFilter: GeometryTypes | undefined;
  @state()
  accessor nameEditIndex: number | undefined;
  @query('ngm-confirmation-modal')
  accessor deleteWarningModal!: NgmConfirmationModal;

  protected firstUpdated() {
    this.querySelectorAll('.ngm-action-menu').forEach((el) => $(el).dropdown());
  }

  updated(changedProperties: PropertyValues) {
    const geoms = changedProperties.get('geometries');
    if (geoms || changedProperties.get('selectedFilter')) {
      this.querySelectorAll('.ngm-action-menu').forEach((el) =>
        $(el).dropdown(),
      );
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

  onEditNameClick(index: number) {
    if (this.nameEditIndex !== undefined) {
      const geometry = this.geometries[this.nameEditIndex];
      ToolboxStore.nextGeometryAction({
        id: geometry.id!,
        newName: geometry.name!,
        action: 'changeName',
      });
    }
    this.nameEditIndex = this.nameEditIndex === index ? undefined : index;
  }

  actionMenuTemplate(geom: NgmGeometry) {
    if (this.viewMode) return '';
    const editButton = this.noEditMode
      ? ''
      : html` <div
          class="item ${classMap({ disabled: !geom.editable })}"
          @click=${() =>
            ToolboxStore.setOpenedGeometryOptions({
              id: geom.id!,
              editing: true,
            })}
        >
          ${i18next.t('tbx_edit_btn')}
        </div>`;
    const copyButton = this.noEditMode
      ? ''
      : html` <div
          class="item ${classMap({ disabled: !geom.copyable })}"
          @click=${() =>
            ToolboxStore.nextGeometryAction({ id: geom.id!, action: 'copy' })}
        >
          ${i18next.t('tbx_copy_btn')}
        </div>`;
    return html`
      <div class="menu">
        ${this.hideMapInteractionButtons
          ? ''
          : html`
              <div
                class="item"
                @click=${() =>
                  ToolboxStore.nextGeometryAction({
                    id: geom.id!,
                    action: 'zoom',
                  })}
              >
                ${i18next.t('tbx_fly_to_btn_hint')}
              </div>
              <div
                class="item"
                @click=${() =>
                  ToolboxStore.setOpenedGeometryOptions({ id: geom.id! })}
              >
                ${i18next.t('tbx_info_btn')}
              </div>
              ${editButton}
            `}
        ${copyButton}
        ${geom.type === 'line'
          ? html` <div
              class="item"
              @click=${() =>
                ToolboxStore.nextGeometryAction({
                  id: geom.id!,
                  action: 'profile',
                })}
            >
              ${i18next.t('tbx_profile_btn')}
            </div>`
          : html``}
        ${this.noEditMode
          ? ''
          : html` <div
              class="item ${classMap({ disabled: !geom.editable })}"
              @click=${() =>
                ToolboxStore.nextGeometryAction({
                  id: geom.id!,
                  action: 'remove',
                })}
            >
              ${i18next.t('tbx_remove_btn_label')}
            </div>`}
      </div>
    `;
  }

  filterMenuTemplate() {
    if (this.viewMode) return '';
    return html`
      <div class="menu">
        <div
          class="item"
          @click=${() =>
            ToolboxStore.nextGeometryAction({
              type: this.selectedFilter,
              action: 'showAll',
              noEditGeometries: this.noEditMode,
            })}
        >
          ${i18next.t('tbx_show_all_btn')}
        </div>
        <div
          class="item"
          @click=${() =>
            ToolboxStore.nextGeometryAction({
              type: this.selectedFilter,
              action: 'hideAll',
              noEditGeometries: this.noEditMode,
            })}
        >
          ${i18next.t('tbx_hide_all_btn')}
        </div>
        <div
          class="item"
          @click=${() =>
            ToolboxStore.nextGeometryAction({
              type: this.selectedFilter,
              action: 'downloadAll',
              noEditGeometries: this.noEditMode,
            })}
        >
          ${i18next.t('tbx_download_all_btn')}
        </div>
        <div class="item" @click=${() => (this.deleteWarningModal.show = true)}>
          ${i18next.t('tbx_remove_all_btn')}
        </div>
      </div>
    `;
  }

  geometryNameTemplate(geom: NgmGeometry, index: number, disabled: boolean) {
    return html` <div>
        ${this.nameEditIndex !== index
          ? html` <div
                title=${geom.show
                  ? i18next.t('tbx_hide_btn_label')
                  : i18next.t('tbx_unhide_btn_label')}
                class="ngm-layer-icon ${classMap({
                  'ngm-visible-icon': !!geom.show,
                  'ngm-invisible-icon': !geom.show,
                })}"
                @click=${() =>
                  ToolboxStore.nextGeometryAction({
                    id: geom.id!,
                    action: geom.show ? 'hide' : 'show',
                  })}
              ></div>
              <div
                class="ngm-geom-name"
                @click=${() =>
                  !disabled &&
                  this.dispatchEvent(
                    new CustomEvent('geomclick', {
                      detail: geom,
                      bubbles: true,
                    }),
                  )}
              >
                ${geom.name}
              </div>`
          : html` <div
              class="ngm-input ${classMap({ 'ngm-input-warning': !geom.name })}"
            >
              <input
                type="text"
                placeholder="required"
                .value=${geom.name}
                @input=${(evt) => {
                  geom.name = evt.target.value;
                }}
              />
            </div>`}
      </div>
      ${this.directNameEdit
        ? html` <div
            class="ngm-icon ngm-edit-icon ${classMap({
              active: this.nameEditIndex === index,
            })}"
            @click=${() => this.onEditNameClick(index)}
          ></div>`
        : ''}`;
  }

  render() {
    const geometries = this.selectedFilter
      ? this.geometries.filter((geom) => geom.type === this.selectedFilter)
      : this.geometries;

    if (!geometries.length && !this.selectedFilter) {
      return '';
    }
    return html`
            <div .hidden="${!this.listTitle}" class="ngm-geom-label">${this.listTitle}</div>
            <div class="ngm-action-list-item ngm-geom-filter">
                <div class="ngm-action-list-item-header">
                    <div class=${classMap({ active: !this.selectedFilter })} @click=${() => this.selectFilter()}>
                        ${i18next.t('tbx_all_label')}
                    </div>
                    <div class="ngm-point-draw-icon ${classMap({ active: this.selectedFilter === 'point' })}"
                         title=${i18next.t('tbx_filter_point')}
                         @click=${() => this.selectFilter('point')}>
                    </div>
                    <div class="ngm-line-draw-icon ${classMap({ active: this.selectedFilter === 'line' })}"
                         title=${i18next.t('tbx_filter_line')}
                         @click=${() => this.selectFilter('line')}>
                    </div>
                    <div class="ngm-polygon-draw-icon ${classMap({ active: this.selectedFilter === 'polygon' })}"
                         title=${i18next.t('tbx_filter_polygon')}
                         @click=${() => this.selectFilter('polygon')}>
                    </div>
                    <div class="ngm-rectangle-draw-icon ${classMap({ active: this.selectedFilter === 'rectangle' })}"
                         title=${i18next.t('tbx_filter_rectangle')}
                         @click=${() => this.selectFilter('rectangle')}>
                    </div>
                    ${
                      this.viewMode
                        ? ''
                        : html` <div
                            class="ui dropdown right pointing ngm-action-menu"
                          >
                            <div class="ngm-action-menu-icon"></div>
                            ${this.filterMenuTemplate()}
                          </div>`
                    }
                </div>
            </div>
            <div class="ngm-geom-list">
                ${geometries.map((geom, index) => {
                  const isDisabled =
                    (this.disabledCallback && this.disabledCallback(geom)) ||
                    this.disabledTypes.includes(geom.type) ||
                    this.editingEnabled;
                  const isActive = !isDisabled && this.selectedId === geom.id;
                  const isHidden =
                    !isDisabled &&
                    !isActive &&
                    !geom.show &&
                    geom.id !== ToolboxStore.sliceGeomId;
                  return html`
                    <div
                      class="ngm-action-list-item ngm-geom-item ${classMap({
                        active: isActive,
                        disabled: isDisabled,
                        hidden: isHidden,
                      })}"
                    >
                      <div
                        class="ngm-action-list-item-header ${classMap({
                          view: this.viewMode,
                        })}"
                      >
                        ${this.geometryNameTemplate(geom, index, isDisabled)}
                        ${this.viewMode
                          ? ''
                          : html` <div
                              class="ui dropdown right pointing ngm-action-menu"
                            >
                              <div class="ngm-action-menu-icon"></div>
                              ${this.actionMenuTemplate(geom)}
                            </div>`}
                      </div>
                      ${this.optionsTemplate
                        ? this.optionsTemplate(geom, isActive)
                        : ''}
                    </div>
                  `;
                })}
            </div>
            <ngm-confirmation-modal
                    @onModalConfirmation="${() =>
                      ToolboxStore.nextGeometryAction({
                        type: this.selectedFilter,
                        action: 'removeAll',
                        noEditGeometries: this.noEditMode,
                      })}"
                    .text="${{
                      title: i18next.t('tbx_remove_all_warn_title'),
                      description: i18next.t('tbx_remove_all_warn_description'),
                      cancelBtn: i18next.t('cancel'),
                      confirmBtn: i18next.t('tbx_remove_all_btn'),
                    }}"
            > </ngm-confirmation-modal`;
  }

  createRenderRoot() {
    return this;
  }
}
