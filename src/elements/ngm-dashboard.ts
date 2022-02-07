import {LitElementI18n, toLocaleDateString} from '../i18n';
import {customElement, property, state} from 'lit/decorators.js';
import {html} from 'lit';
import i18next from 'i18next';
import {styleMap} from 'lit/directives/style-map.js';
import {classMap} from 'lit-html/directives/class-map.js';
import MainStore from '../store/main';
import ToolboxStore from '../store/toolbox';
import {getCameraView, syncTargetParam} from '../permalink';
import NavToolsStore from '../store/navTools';
import DashboardStore from '../store/dashboard';

export interface TranslatedText {
  de: string,
  fr: string,
  it: string,
  en: string,
}

export interface DashboardProjectView {
  title: TranslatedText,
  permalink: string
}

export interface DashboardProject {
  title: TranslatedText,
  description: TranslatedText,
  created: string,
  modified: string,
  image: string,
  color: string,
  views: DashboardProjectView[]
}

export interface SelectedView {
  project: DashboardProject,
  viewIndex: number
}

@customElement('ngm-dashboard')
export class NgmDashboard extends LitElementI18n {
  @property({type: Boolean}) hidden = true;
  @state() activeTab: 'topics' | 'project' = 'topics';
  @state() selectedProject: DashboardProject | undefined;
  @state() projects: DashboardProject[] | undefined;

  constructor() {
    super();
    DashboardStore.viewIndex.subscribe(viewIndex => {
      this.selectView(viewIndex);
    });
  }

  async update(changedProperties) {
    if (!this.hidden && !this.projects) {
      this.projects = await (await fetch('./src/sampleData/showcase_projects.json')).json();
      // sort by newest first
      this.projects?.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    }
    super.update(changedProperties);
  }

  selectView(viewIndex: number) {
    const viewer = MainStore.viewerValue;
    if (!viewer || !this.selectedProject) return;
    syncTargetParam(undefined);
    NavToolsStore.nextTargetPointSync();
    this.dispatchEvent(new CustomEvent('close'));
    DashboardStore.setSelectedView({project: this.selectedProject, viewIndex: viewIndex});
    const permalink = this.selectedProject.views[viewIndex].permalink;
    const url = `${window.location.protocol}//${window.location.host}${window.location.pathname}${permalink}`;
    window.history.pushState({path: url}, '', url);
    MainStore.nextLayersSync();
    MainStore.nextMapSync();
    const {destination, orientation} = getCameraView();
    if (destination && orientation)
      viewer.camera.flyTo({
        destination: destination,
        orientation: orientation,
        duration: 3,
        complete: () => {
          ToolboxStore.nextSliceSync();
          NavToolsStore.nextTargetPointSync();
        }
      });
  }

  previewTemplate(data) {
    return html`
      <div class="ngm-proj-preview" @click=${() => {
        this.selectedProject = data;
      }}>
        <div class="ngm-proj-preview-img" style=${styleMap({backgroundImage: `url('${data.image}')`})}></div>
        <div class="ngm-proj-preview-title" style=${styleMap({backgroundColor: data.color})}>
          <span>${translated(data.title)}</span>
        </div>
        <div class="ngm-proj-preview-subtitle"><span>${translated(data.description)}</span></div>
      </div>`;
  }

  projectTabTemplate() {
    if (!this.selectedProject) return '';
    return html`
      <div>
        <div class="ngm-proj-title">${translated(this.selectedProject.title)}</div>
        <div class="ngm-proj-data">
          ${`${i18next.t('dashboard_modified_title')} ${toLocaleDateString(this.selectedProject.modified)} ${i18next.t('dashboard_by_swisstopo_title')}`}
        </div>
        <div class="ngm-proj-information">
          <div>
            <div class="ngm-proj-preview-img"
                 style=${styleMap({backgroundImage: `url('${this.selectedProject.image}')`})}></div>
            <div class="ngm-proj-preview-title" style=${styleMap({backgroundColor: this.selectedProject.color})}></div>
          </div>
          <div class="ngm-proj-description">
            <div class="ngm-proj-description-title">${i18next.t('dashboard_description')}</div>
            <div class="ngm-proj-description-content">${translated(this.selectedProject.description)}</div>
          </div>
        </div>
      </div>
      <div class="ngm-divider"></div>
      <div class="ngm-proj-views-title">
        <div class="ngm-screenshot-icon"></div>
        <div>${i18next.t('dashboard_views')}</div>
      </div>
      <div class="ngm-project-views">
        ${this.selectedProject.views.map((view, index) => html`
          <div class="ngm-action-list-item" @click=${() => this.selectView(index)}>
            <div class="ngm-action-list-item-header">
              <div>${translated(view.title)}</div>
            </div>
          </div>
        `)}
      </div>
      <div class="ngm-divider"></div>
      <div class="ngm-label-btn" @click=${() => this.selectedProject = undefined}>
        <div class="ngm-back-icon"></div>
        ${i18next.t('dashboard_back_to_topics')}
      </div>
    `;
  }

  render() {
    if (!this.projects) return '';
    return html`
      <div class="ngm-panel-header">
        <div class="ngm-dashboard-tabs">
          <div class=${classMap({active: this.activeTab === 'topics'})}
               @click=${() => {
                 this.activeTab = 'topics';
                 this.selectedProject = undefined;
               }}>
            ${i18next.t('dashboard_topics')}
          </div>
        </div>
        <div class="ngm-close-icon" @click=${() => this.dispatchEvent(new CustomEvent('close'))}></div>
      </div>
      <div ?hidden=${this.selectedProject}>
        <div class="ngm-proj-title">${i18next.t('dashboard_recent_swisstopo')}</div>
        <div class="ngm-projects-list">
          ${this.projects.map(data => this.previewTemplate(data))}
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


function translated(property: TranslatedText): string {
  return property[i18next.language];
}
