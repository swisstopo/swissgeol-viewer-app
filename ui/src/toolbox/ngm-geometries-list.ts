import { LitElementI18n } from '../i18n';
import type { TemplateResult } from 'lit';
import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import ToolboxStore from '../store/toolbox';
import type { GeometryTypes, NgmGeometry } from './interfaces';
import $ from 'jquery';
import './ngm-geometries-simple-list';
import i18next from 'i18next';
import DashboardStore from '../store/dashboard';
import { isProject } from '../elements/dashboard/helpers';

@customElement('ngm-geometries-list')
export default class NgmGeometriesList extends LitElementI18n {
  @property({ type: String })
  accessor selectedId = '';
  @property({ type: Object })
  accessor optionsTemplate:
    | ((geom: NgmGeometry, active: boolean) => TemplateResult)
    | undefined;
  @property({ type: Array })
  accessor disabledTypes: string[] = [];
  @property({ type: Object })
  accessor disabledCallback: ((geom: NgmGeometry) => boolean) | undefined;
  @state()
  accessor geometries: NgmGeometry[] = [];
  @state()
  accessor noEditGeometries: NgmGeometry[] = [];
  @state()
  accessor editingEnabled = false;
  @state()
  accessor selectedFilter: GeometryTypes | undefined;
  @state()
  accessor nameEditIndex: number | undefined;
  private scrollDown = false;

  protected firstUpdated() {
    ToolboxStore.geometries.subscribe((geoms) => {
      this.geometries = geoms;
    });
    ToolboxStore.noEditGeometries.subscribe((geoms) => {
      this.noEditGeometries = geoms;
    });
    ToolboxStore.openedGeometryOptions.subscribe(
      (options) => (this.editingEnabled = !!options?.editing),
    );
    this.querySelectorAll('.ngm-action-menu').forEach((el) => $(el).dropdown());
  }

  updated(changedProperties) {
    const geoms = changedProperties.get('geometries');
    const noEditGeometries = changedProperties.get('noEditGeometries');
    if (geoms || noEditGeometries || changedProperties.get('selectedFilter')) {
      this.querySelectorAll('.ngm-action-menu').forEach((el) =>
        $(el).dropdown(),
      );
    }

    if (this.scrollDown) {
      this.parentElement!.scrollTop = this.parentElement!.scrollHeight;
      this.scrollDown = false;
    }

    if (geoms && geoms.length < this.geometries.length) {
      const newGeometries = this.geometries.filter(
        (leftValue) =>
          !geoms.some((rightValue) => leftValue.id === rightValue.id),
      );
      if (newGeometries.length) {
        this.selectedFilter = undefined;
        this.scrollDown = true;
      }
      this.dispatchEvent(
        new CustomEvent('geometriesadded', { detail: { newGeometries } }),
      );
    }

    super.updated(changedProperties);
  }

  render() {
    const projectMode = DashboardStore.projectMode.value;
    const projectEditMode =
      projectMode === 'viewEdit' || projectMode === 'edit';
    const selectedProject = DashboardStore.selectedTopicOrProject.value;
    return html` <ngm-geometries-simple-list
        .hidden=${!this.noEditGeometries?.length}
        .geometries=${this.noEditGeometries}
        .noEditMode=${true}
        .selectedId=${this.selectedId}
        .listTitle="${isProject(selectedProject)
          ? i18next.t('tbx_project_geometries')
          : i18next.t('tbx_geometries_from_topic')}"
        .optionsTemplate=${this.optionsTemplate}
        .disabledTypes=${this.disabledTypes}
        .disabledCallback=${this.disabledCallback}
        .editingEnabled=${this.editingEnabled}
      >
      </ngm-geometries-simple-list>

      <ngm-geometries-simple-list
        .geometries=${this.geometries}
        .selectedId=${this.selectedId}
        .listTitle="${projectEditMode
          ? `${selectedProject?.title} ${i18next.t('tbx_project_geometries')}`
          : i18next.t('tbx_my_geometries')}"
        .optionsTemplate=${this.optionsTemplate}
        .disabledTypes=${this.disabledTypes}
        .disabledCallback=${this.disabledCallback}
        .editingEnabled=${this.editingEnabled}
      >
      </ngm-geometries-simple-list>`;
  }

  createRenderRoot() {
    return this;
  }
}
