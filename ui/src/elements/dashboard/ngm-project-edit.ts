import {LitElementI18n, toLocaleDateString} from '../../i18n';
import {html, PropertyValues} from 'lit';
import i18next from 'i18next';
import {classMap} from 'lit/directives/class-map.js';
import {styleMap} from 'lit/directives/style-map.js';
import {COLORS_WITH_BLACK_TICK, PROJECT_COLORS} from '../../constants';
import {Project} from './ngm-dashboard';
import {property, customElement} from 'lit/decorators.js';
import $ from '../../jquery';

@customElement('ngm-project-edit')
export class NgmProjectEdit extends LitElementI18n {
    @property({type: Object})
    accessor project: Project | undefined;
    @property({type: Boolean})
    accessor saveOrCancelWarning = false;

    shouldUpdate(_changedProperties: PropertyValues): boolean {
        return this.project !== undefined;
    }

    firstUpdated(_changedProperties: PropertyValues) {
        this.querySelectorAll('.ui.dropdown').forEach(elem => $(elem).dropdown());
        super.firstUpdated(_changedProperties);
    }

    render() {
        const project: Project = <Project> this.project;
        const backgroundImage = project.image?.length ? `url('${project.image}')` : '';
        return html`
            <div>
              <div class="ui warning message" ?hidden=${!this.saveOrCancelWarning}>
                ${i18next.t('project_lost_changes_warning')}
              </div>
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
                    ${i18next.t('edit_project')}<div class="ngm-edit-icon active"></div>
                  </div>
                </div>
              </div>
              <div class="ngm-proj-data">
                ${`${i18next.t('dashboard_modified_title')} ${toLocaleDateString(project.modified)} ${i18next.t('dashboard_by_swisstopo_title')}`}
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
            <div class="ngm-proj-views-title">
              <div class="ngm-screenshot-icon"></div>
              <div>${i18next.t('dashboard_views')}</div>
            </div>
            <div class="project-views-edit">
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