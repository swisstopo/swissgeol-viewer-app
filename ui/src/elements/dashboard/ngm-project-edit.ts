import {LitElementI18n, toLocaleDateString} from '../../i18n';
import {html, PropertyValues} from 'lit';
import i18next from 'i18next';
import {classMap} from 'lit/directives/class-map.js';
import {styleMap} from 'lit/directives/style-map.js';
import {COLORS_WITH_BLACK_TICK, PROJECT_COLORS} from '../../constants';
import {CreateProject, Project} from './ngm-dashboard';
import {property, customElement, query, state} from 'lit/decorators.js';
import $ from '../../jquery';
import '../../toolbox/ngm-geometries-list';
import '../../layers/ngm-layers-upload';
import {apiClient} from '../../api-client';
import {showSnackbarError} from '../../notifications';

@customElement('ngm-project-edit')
export class NgmProjectEdit extends LitElementI18n {
    @property({type: Object})
    accessor project: Project | CreateProject | undefined;
    @property({type: Boolean})
    accessor saveOrCancelWarning = false;
    @property({type: Boolean})
    accessor createMode = true;
    @query('.ngm-proj-toast-placeholder')
    accessor toastPlaceholder;
    @state()
    accessor kmlEditIndex: number | undefined;

    async onKmlUpload(file: File) {
        if (!this.project) return;
        try {
            const response = await apiClient.uploadProjectAsset(file);
            const key: string = (await response.json())?.key;
            if (key) {
                const assets = [...this.project!.assets, {name: file.name, key}];
                this.project = {...this.project, assets};
            }
        } catch (e) {
            console.error(e);
            showSnackbarError(i18next.t('dtd_cant_upload_kml_error')); // todo add new message
        }
    }

    shouldUpdate(_changedProperties: PropertyValues): boolean {
        return this.project !== undefined;
    }

    firstUpdated(_changedProperties: PropertyValues) {
        this.querySelectorAll('.ui.dropdown').forEach(elem => $(elem).dropdown());
        super.firstUpdated(_changedProperties);
    }

    render() {
        if (!this.project) return '';
        const project = this.project;
        const backgroundImage = project.image?.length ? `url('${project.image}')` : '';
        return html`
            <div>
              <div class="ui warning message" ?hidden=${!this.saveOrCancelWarning}>
                ${i18next.t('project_lost_changes_warning')}
              </div>
              <div class="ngm-proj-toast-placeholder"></div>
              <div class="ngm-proj-title">
                <div class="ngm-input project-title ${classMap({'ngm-input-warning': !project.title})}">
                  <input type="text" placeholder="required" .value=${<string>project.title}
                         @input=${evt => {
                                     project.title = evt.target.value;
                                     this.requestUpdate();
                                 }}/>
                  <span class="ngm-floating-label">${i18next.t('project_title')}</span>
                </div>
                <div class="project-menu">
                  <div class="edit-project active">
                    ${this.createMode ? i18next.t('dashboard_project_create') : i18next.t('edit_project')}<div class="ngm-edit-icon active"></div>
                  </div>
                </div>
              </div>
              <div class="ngm-proj-data" ?hidden="${this.createMode}">
                ${`${i18next.t('dashboard_modified_title')} ${toLocaleDateString((<Project>project).modified)} ${i18next.t('dashboard_by_swisstopo_title')}`}
              </div>
              <div class="ngm-proj-information">
                <div class="project-image-and-color">
                  <div class="ngm-proj-preview-img"
                       style=${styleMap({backgroundImage})}></div>
                  <div class="project-color-picker" style=${styleMap({backgroundColor: 'white'})}>
                    <div class="ngm-geom-colorpicker">
                      ${PROJECT_COLORS.map(color => html`
                  <div
                          style="background-color: ${color};"
                          @click=${() => {
                              project.color = color;
                              this.requestUpdate();
                          }}
                          class="ngm-geom-color ${classMap({
                              active: project.color === color,
                              'black-tick': COLORS_WITH_BLACK_TICK.includes(color)
                          })}">
                  </div>`
              )}
                    </div>
                  </div>
                </div>
                <div class="ngm-input ngm-textarea project-description">
                  <textarea type="text" placeholder="required"
                            .value=${<string>project.description || ''}
                            @input=${evt => project.description = evt.target.value}></textarea>
                  <span class="ngm-floating-label">${i18next.t('project_description')}</span>
                </div>
              </div>
            </div>
            <div class="ngm-divider"></div>
            <div class="ngm-proj-title-icon">
              <div class="ngm-screenshot-icon"></div>
              <div>${i18next.t('dashboard_views')}</div>
            </div>
            <div class="project-edit-fields">
              ${project.views.map((view, index) => html`
                  <div class="project-view-edit">
                      <div class="ngm-input ${classMap({'ngm-input-warning': !view.title})}">
                          <input type="text" placeholder="required" .value=${<string>view.title}
                                 @input=${evt => {
                                     view.title = evt.target.value;
                                     this.requestUpdate();
                                 }}/>
                          <span class="ngm-floating-label">${i18next.t('project_view')}</span>
                      </div>
                      <div class="ui dropdown right pointing ngm-action-menu">
                          <div class="ngm-view-icon ngm-action-menu-icon"></div>
                          <div class="menu">
                              <div class="item"
                                   ?hidden=${index === 0}
                                   @click=${() => {
                                       array_move(project.views, index, index - 1);
                                       this.requestUpdate();
                                   }}>
                                  ${i18next.t('move_up')}
                              </div>
                              <div class="item"
                                   ?hidden=${index === project.views.length - 1}
                                   @click=${() => {
                                       array_move(project.views, index, index + 1);
                                       this.requestUpdate();
                                   }}>
                                  ${i18next.t('move_down')}
                              </div>
                              <div class="item"
                                   @click=${() => {
                                       project.views.splice(index, 1);
                                       this.requestUpdate();
                                   }}>
                                  ${i18next.t('delete')}
                              </div>
                          </div>
                      </div>
                  </div>
              `)}
            </div>
            <div class="ngm-divider"></div>
            <div class="ngm-proj-edit-assets">
                <div>
                    <div class="ngm-proj-title-icon">
                        <div class="ngm-vector-icon"></div>
                        <div>${i18next.t('dashboard_project_geometries')}</div>
                    </div>
                    <div class="project-edit-fields">
                        ${this.project.geometries?.length ?
                                html`<ngm-geometries-list></ngm-geometries-list>` :
                                html`<div>${i18next.t('dashboard_no_geom_text')}</div>`}
                    </div>
                </div>
                <div>
                    <div class="ngm-proj-title-icon">
                        <div class="ngm-file-upload-icon"></div>
                        <div>${i18next.t('dashboard_project_kml')}</div>
                    </div>
                    <div class="project-edit-fields">
                        <ngm-layers-upload
                                .toastPlaceholder=${this.toastPlaceholder}
                                .onKmlUpload=${(file: File) => this.onKmlUpload(file)}></ngm-layers-upload>
                        ${this.project?.assets.map((kml, index) => {
                            return html`
                             <div class="ngm-action-list-item ngm-geom-item">
                               <div class="ngm-action-list-item-header">
                                 <div>
                                   ${this.kmlEditIndex !== index ? kml.name : html`
                                   <div class="ngm-input ${classMap({'ngm-input-warning': !kml.name})}">
                                         <input type="text" placeholder="required" .value=${kml.name}
                                                @input=${evt => {
                                kml.name = evt.target.value;
                                project!.assets[index] = kml;
                                this.project = {...project};
                            }}/>
                                     </div>`}
                                 </div>
                                 <div class="ngm-icon ngm-edit-icon ${classMap({
                                active: this.kmlEditIndex === index
                            })}" 
                                      @click=${() => {
                                this.kmlEditIndex = this.kmlEditIndex === index ? undefined : index;
                            }}>
                                 </div>
                                 <div class="ngm-icon ngm-delete-icon"
                                      @click=${() => {
                                project.assets.splice(index, 1);
                                this.project = {...project};
                            }}>
                                 </div>
                               </div>
                             </div>
                            `;
                        })}
                    </div>
                </div>
            </div>
            <div class="ngm-divider"></div>
            <div class="ngm-label-btn" @click=${() => this.dispatchEvent(new CustomEvent('onBack'))}>
              <div class="ngm-back-icon"></div>
              ${i18next.t('dashboard_back_to_topics')}
            </div>
            <div class="project-edit-buttons">
              <button class="ui button ngm-action-btn ${classMap({'ngm-disabled': !project.title})}"
                      @click=${() => this.dispatchEvent(new CustomEvent('onSave', {detail: {project}}))}>
                ${i18next.t('save_project')}
              </button>
              <button class="ui button ngm-action-btn ngm-cancel-btn"
                      @click=${() => this.dispatchEvent(new CustomEvent('onCancel'))}>
                ${i18next.t('cancel')}
              </button>
            </div>
    `;
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