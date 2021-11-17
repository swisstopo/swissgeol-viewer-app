import {LitElementI18n} from '../i18n';
import {customElement, state} from 'lit/decorators.js';
import {html} from 'lit';
import i18next from 'i18next';
import {styleMap} from 'lit/directives/style-map.js';
import {SHOWCASE_PROJECTS} from '../constants';
import {classMap} from 'lit-html/directives/class-map.js';

@customElement('ngm-dashboard')
export class NgmDashboard extends LitElementI18n {
  @state() activeTab: 'dashboard' | 'project' = 'dashboard';
  @state() selectedProject: any | undefined;

  previewTemplate(data) {
    return html`
      <div class="ngm-proj-preview" @click=${() => {
        this.selectedProject = data;
        this.activeTab = 'project';
      }}>
        <div class="ngm-proj-preview-img" style=${styleMap({backgroundImage: `url('${data.image}')`})}></div>
        <div class="ngm-proj-preview-title" style=${styleMap({backgroundColor: data.color})}>
          <span>${data.title}</span>
        </div>
        <div class="ngm-proj-preview-subtitle"><span>${data.subtitle}</span></div>
      </div>`;
  }

  projectTabTemplate() {
    if (!this.selectedProject) return '';
    return html`
      <div class="ngm-projects-title">${this.selectedProject.title}</div>
      <div class="ngm-project-info">
        <div class="ngm-proj-preview-img"
             style=${styleMap({backgroundImage: `url('${this.selectedProject.image}')`})}></div>
      </div>
      <div class="ngm-proj-preview-title" style=${styleMap({backgroundColor: this.selectedProject.color})}></div>
      <div class="ngm-divider"></div>
      <div class="ngm-proj-views-title">
        <div class="ngm-screenshot-icon"></div>
        <div>${i18next.t('dashboard_views')}</div>
      </div>
      <div class="ngm-project-views">
        ${this.selectedProject.views.map(view => html`
          <div class="ngm-action-list-item">
            <div class="ngm-action-list-item-header">
              <div>${view.title}</div>
            </div>
          </div>
        `)}
      </div>
    `;
  }

  render() {
    return html`
      <div class="ngm-panel-header">
        <div class="ngm-dashboard-tabs">
          <div class=${classMap({active: this.activeTab === 'dashboard'})}
               @click=${() => {
                 this.activeTab = 'dashboard';
                 this.selectedProject = undefined;
               }}>
            ${i18next.t('lsb_dashboard')}
          </div>
          <div class=${classMap({active: this.activeTab === 'project'})} @click=${() => this.activeTab = 'project'}>
            ${i18next.t('dashboard_swisstopo_template')}
          </div>
        </div>
        <div class="ngm-close-icon" @click=${() => this.dispatchEvent(new CustomEvent('close'))}></div>
      </div>
      <div ?hidden=${this.selectedProject}>
        <div class="ngm-projects-title">${i18next.t('dashboard_recent_swisstopo')}</div>
        <div class="ngm-projects-list">
          ${SHOWCASE_PROJECTS.map(data => this.previewTemplate(data))}
        </div>
      </div>
      <div ?hidden=${!this.selectedProject}>
        ${this.projectTabTemplate()}
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
