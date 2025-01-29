import { LitElementI18n, toLocaleDateString } from '../../i18n';
import { html, PropertyValues } from 'lit';
import i18next from 'i18next';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { COLORS_WITH_BLACK_TICK, PROJECT_COLORS } from '../../constants';
import {
  Asset,
  CreateProject,
  Member,
  Project,
  type View,
} from './ngm-dashboard';
import { customElement, property, query } from 'lit/decorators.js';
import $ from 'jquery';
import '../../toolbox/ngm-geometries-list';
import { ApiClient } from '../../api/api-client';
import {
  showSnackbarError,
  showBannerWarning,
  isBannerShown,
} from '../../notifications';
import './ngm-project-geoms-section';
import './ngm-project-assets-section';
import { MemberToAdd } from './ngm-add-member-form';
import { isProject } from './helpers';
import DashboardStore from '../../store/dashboard';
import { CustomDataSource } from 'cesium';
import MainStore from '../../store/main';
import { parseKml } from '../../cesiumutils';
import { getPermalink } from '../../permalink';
import { consume } from '@lit/context';
import { apiClientContext } from '../../context';

@customElement('ngm-project-edit')
export class NgmProjectEdit extends LitElementI18n {
  @property({ type: Object })
  accessor project: Project | CreateProject | undefined;
  @property({ type: Boolean })
  accessor saveOrCancelWarning = false;
  @property({ type: Boolean })
  accessor createMode = true;
  @property({ type: String })
  accessor userEmail: string = '';
  @property({ type: Object })
  accessor tempKmlDataSource: CustomDataSource | undefined;
  @query('.ngm-toast-placeholder')
  accessor toastPlaceholder;

  @consume({ context: apiClientContext })
  accessor apiClient!: ApiClient;

  async onKmlUpload(file: File, clampToGround: boolean) {
    if (!this.project) return;
    try {
      const response = await this.apiClient.uploadProjectAsset(file);
      const key: string = (await response.json())?.key;
      if (key) {
        const assets = [
          ...this.project!.assets,
          { name: file.name, key, clampToGround },
        ];
        this.project = { ...this.project, assets };
        const viewer = MainStore.viewer.value;
        if (viewer && this.tempKmlDataSource) {
          const name = await parseKml(
            viewer,
            file,
            this.tempKmlDataSource,
            clampToGround,
          );
          MainStore.addUploadedKmlName(name);
          viewer.scene.requestRender();
          viewer.flyTo(this.tempKmlDataSource);
        }
      }
    } catch (e) {
      console.error(e);
      showSnackbarError(i18next.t('dtd_cant_upload_kml_error'));
    }
  }

  onMemberAdd(evt: { detail: MemberToAdd }) {
    if (!this.project) return;
    const role = evt.detail.role;
    const member = {
      name: evt.detail.name,
      surname: evt.detail.surname,
      email: evt.detail.email,
    };
    if (role === 'editor') {
      this.project.editors.push(member);
    } else if (role === 'viewer') {
      this.project.viewers.push(member);
    }
    this.project = { ...this.project };
  }

  onMemberDelete(evt: { detail: MemberToAdd }) {
    if (!this.project) return;
    const role = evt.detail.role;
    const memberEmail = evt.detail.email;
    let arrayToEdit: Member[] = [];
    if (role === 'editor') {
      arrayToEdit = this.project.editors;
    } else if (role === 'viewer') {
      arrayToEdit = this.project.viewers;
    }
    const index = arrayToEdit.findIndex((m) => m.email === memberEmail);
    if (index > -1) {
      arrayToEdit.splice(index, 1);
    }
    this.project = { ...this.project };
  }

  shouldUpdate(_changedProperties: PropertyValues): boolean {
    return this.project !== undefined;
  }

  showSaveOrCancelWarning() {
    if (!isBannerShown(this.toastPlaceholder))
      showBannerWarning(
        this.toastPlaceholder,
        i18next.t('project_lost_changes_warning'),
      );
    DashboardStore.showSaveOrCancelWarning(false);
  }

  updated(changedProperties) {
    if (
      changedProperties.has('saveOrCancelWarning') &&
      this.saveOrCancelWarning
    ) {
      this.showSaveOrCancelWarning();
    }
    if (changedProperties.has('project')) {
      this.querySelectorAll('.ui.dropdown').forEach((elem) =>
        $(elem).dropdown(),
      );
    }
  }

  firstUpdated(_changedProperties: PropertyValues) {
    this.querySelectorAll('.ui.dropdown').forEach((elem) => $(elem).dropdown());
    super.firstUpdated(_changedProperties);
  }

  render() {
    if (!this.project) return '';
    const project = this.project;
    const backgroundImage = project.image?.length
      ? `url('${project.image}')`
      : '';
    return html`
      <div>
        <div class="ngm-toast-placeholder" id="project-toast"></div>
        <div class="ngm-proj-title">
          <div
            class="ngm-input project-title ${classMap({
              'ngm-input-warning': !project.title,
            })}"
          >
            <input
              type="text"
              placeholder="required"
              .value=${<string>project.title}
              @input=${(evt) => {
                project.title = evt.target.value;
                this.requestUpdate();
              }}
            />
            <span class="ngm-floating-label"
              >${i18next.t('project_title')}</span
            >
          </div>
          <div class="project-menu">
            <div class="edit-project active">
              ${this.createMode
                ? i18next.t('dashboard_project_create')
                : i18next.t('dashboard_project_in_edit')}
              <div class="ngm-edit-icon active"></div>
            </div>
          </div>
        </div>
        ${this.createMode || !isProject(project)
          ? ''
          : html` <div class="ngm-proj-data">
              ${`${i18next.t('dashboard_modified_title')} ${toLocaleDateString(project.modified)} ${i18next.t('dashboard_by_swisstopo_title')}`}
            </div>`}
        <div class="ngm-proj-information">
          <div class="project-image-and-color">
            <div
              class="ngm-proj-preview-img"
              style=${styleMap({ backgroundImage })}
            ></div>
            <div
              class="project-color-picker"
              style=${styleMap({ backgroundColor: 'white' })}
            >
              <div class="ngm-geom-colorpicker">
                ${PROJECT_COLORS.map(
                  (color) =>
                    html` <div
                      style="background-color: ${color};"
                      @click=${() => {
                        project.color = color;
                        this.requestUpdate();
                      }}
                      class="ngm-geom-color ${classMap({
                        active: project.color === color,
                        'black-tick': COLORS_WITH_BLACK_TICK.includes(color),
                      })}"
                    ></div>`,
                )}
              </div>
            </div>
          </div>
          <div class="ngm-input ngm-textarea project-description">
            <textarea
              type="text"
              placeholder="required"
              .value=${<string>project.description || ''}
              @input=${(evt) => (project.description = evt.target.value)}
            ></textarea>
            <span class="ngm-floating-label"
              >${i18next.t('project_description')}</span
            >
          </div>
        </div>
      </div>
      <div class="ngm-divider"></div>
      <div class="ngm-proj-views-header">
        <div class="ngm-proj-title-icon">
          <div class="ngm-screenshot-icon"></div>
          <div>${i18next.t('dashboard_views')}</div>
        </div>
        <button
          class="ngm-save-view-btn"
          .hidden="${!this.userEmail || !project?.owner}"
          @click=${() => this.saveViewToProject()}
        >
          <div>${i18next.t('dashboard_add_view')}</div>
          <div class="ngm-save-icon icon"></div>
        </button>
      </div>
      <div class="project-edit-fields">
        ${project.views.map(
          (view, index) => html`
            <div class="project-view-edit">
              <div
                class="ngm-input ${classMap({
                  'ngm-input-warning': !view.title,
                })}"
              >
                <input
                  type="text"
                  placeholder="required"
                  .value=${<string>view.title}
                  @input=${(evt) => {
                    view.title = evt.target.value;
                    this.requestUpdate();
                  }}
                />
                <span class="ngm-floating-label"
                  >${i18next.t('project_view')}</span
                >
              </div>
              <div class="ui dropdown right pointing ngm-action-menu">
                <div class="ngm-view-icon ngm-action-menu-icon"></div>
                <div class="menu">
                  <div
                    class="item"
                    ?hidden=${index === 0}
                    @click=${() => {
                      array_move(project.views, index, index - 1);
                      this.requestUpdate();
                    }}
                  >
                    ${i18next.t('move_up')}
                  </div>
                  <div
                    class="item"
                    ?hidden=${index === project.views.length - 1}
                    @click=${() => {
                      array_move(project.views, index, index + 1);
                      this.requestUpdate();
                    }}
                  >
                    ${i18next.t('move_down')}
                  </div>
                  <div
                    class="item"
                    @click=${() => {
                      project.views.splice(index, 1);
                      this.requestUpdate();
                    }}
                  >
                    ${i18next.t('delete')}
                  </div>
                </div>
              </div>
            </div>
          `,
        )}
      </div>
      <div class="ngm-divider"></div>
      <div class="ngm-proj-edit-assets">
        <ngm-project-geoms-section
          .geometries="${project.geometries}"
        ></ngm-project-geoms-section>
        <ngm-project-assets-section
          .assets="${project.assets}"
          .toastPlaceholder="${this.toastPlaceholder}"
          .onKmlUpload="${(file: File, clampToGround: boolean) =>
            this.onKmlUpload(file, clampToGround)}"
          @assetsChanged="${(evt: { detail: { assets: Asset[] } }) => {
            project!.assets = evt.detail.assets;
            this.project = { ...project };
          }}"
        ></ngm-project-assets-section>
      </div>
      <div class="ngm-divider"></div>
      <ngm-project-members-section
        .project=${project}
        .edit=${project.owner.email === this.userEmail}
        @onMemberAdd=${(evt) => this.onMemberAdd(evt)}
        @onMemberDelete=${(evt) => this.onMemberDelete(evt)}
      ></ngm-project-members-section>
      <div class="ngm-divider"></div>
      <div
        class="ngm-label-btn"
        @click=${() => this.dispatchEvent(new CustomEvent('onBack'))}
      >
        <div class="ngm-back-icon"></div>
        ${i18next.t('dashboard_back_to_topics')}
      </div>
      <div class="project-edit-buttons">
        <button
          class="ui button ngm-action-btn ${classMap({
            'ngm-disabled': !project.title,
          })}"
          @click=${() =>
            this.dispatchEvent(
              new CustomEvent('onSave', { detail: { project } }),
            )}
        >
          ${i18next.t('save_project')}
        </button>
        <button
          class="ui button ngm-action-btn ngm-cancel-btn"
          @click=${() => this.dispatchEvent(new CustomEvent('onCancel'))}
        >
          ${i18next.t('cancel')}
        </button>
      </div>
    `;
  }

  async saveViewToProject() {
    if (!this.project) return;
    const project = { ...this.project };
    const view: View = {
      id: crypto.randomUUID(),
      title: `${i18next.t('view')} ${project.views.length + 1}`,
      permalink: getPermalink(),
    };
    project.views.push(view);
    this.project = project;
  }

  createRenderRoot() {
    return this;
  }
}

function array_move(arr, old_index, new_index) {
  if (new_index >= arr.length) {
    let k = new_index - arr.length + 1;
    while (k--) {
      arr.push(undefined);
    }
  }
  arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
}
