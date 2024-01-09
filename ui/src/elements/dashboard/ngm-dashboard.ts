import {LitElementI18n, translated} from '../../i18n';
import {customElement, property, query, state} from 'lit/decorators.js';
import {html, PropertyValues} from 'lit';
import i18next from 'i18next';
import {styleMap} from 'lit/directives/style-map.js';
import {classMap} from 'lit-html/directives/class-map.js';
import MainStore from '../../store/main';
import ToolboxStore from '../../store/toolbox';
import {getCameraView, getPermalink, removeTopic, removeProject, setPermalink, syncStoredView, syncTargetParam} from '../../permalink';
import NavToolsStore from '../../store/navTools';
import DashboardStore from '../../store/dashboard';
import LocalStorageController from '../../LocalStorageController';
import type {Viewer} from 'cesium';
import {CustomDataSource, KmlDataSource} from 'cesium';
import {showBannerWarning, showSnackbarError} from '../../notifications';
import type {Config} from '../../layers/ngm-layers-item';
import {DEFAULT_LAYER_OPACITY, DEFAULT_PROJECT_COLOR, PROJECT_ASSET_URL} from '../../constants';
import {fromGeoJSON} from '../../toolbox/helpers';
import type {NgmGeometry} from '../../toolbox/interfaces';
import {apiClient} from '../../api-client';
import AuthStore from '../../store/auth';
import '../hide-overflow';
import './ngm-project-edit';
import './ngm-project-topic-overview';
import {isProject} from './helpers';

type TextualAttribute = string | TranslatedText;

export interface TranslatedText {
  de: string,
  fr: string,
  it: string,
  en: string,
}

export interface View {
  id: string,
  title: TextualAttribute,
  permalink: string,
}

export interface Asset {
  name: string,
  key: string,
}

export interface Member {
  email: string,
  name: string,
  surname: string
}

export interface Topic {
  id: string,
  title: TextualAttribute,
  description: TextualAttribute,
  created: string,
  modified: string,
  image: string,
  color: string,
  views: View[],
  assets: Asset[],
  geometries?: NgmGeometry[],
}

export interface CreateProject {
  title: string,
  description?: string,
  image?: string,
  color: string,
  views: View[],
  assets: Asset[],
  geometries?: NgmGeometry[],
  owner: Member,
  editors: Member[],
  viewers: Member[],
}

export interface Project extends CreateProject {
  id: string,
  created: string,
  modified: string,
}

export type TabTypes = 'topics' | 'overview' | 'projects' | 'shared';

@customElement('ngm-dashboard')
export class NgmDashboard extends LitElementI18n {
  @property({type: Boolean})
  accessor hidden = true;
  @state()
  accessor projects: Project[] = [];
  @state()
  accessor activeTab: TabTypes = 'topics';
  @state()
  accessor selectedTopicOrProject: Topic | Project | undefined;
  @state()
  accessor projectToCreate: CreateProject | undefined;
  @state()
  accessor topics: Topic[] | undefined;
  @state()
  accessor selectedViewIndx: number | undefined;
  @state()
  accessor projectMode: 'edit' | 'create' | 'view' = 'view';
  @state()
  accessor saveOrCancelWarning = false;
  @query('.ngm-toast-placeholder')
  accessor toastPlaceholder;
  @query('#overview-toast')
  accessor overviewToast;
  private viewer: Viewer | null = null;
  private assetConfigs: any = {};
  private assets: Config[] | undefined;
  private geometries: NgmGeometry[] = [];
  private recentlyViewedIds: Array<string> = [];
  private userEmail: string | undefined;

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
    fetch('./src/sampleData/topics.json').then(topicsResponse =>
      topicsResponse.json().then(topics => {
        this.topics = topics.map(topic => {
          if (topic.geometries) {
            topic.geometries = this.getGeometries(topic.geometries);
          }
          return topic;
        }).sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
        DashboardStore.topicOrProjectParam.subscribe(async value => {
          if (!value) return;
          if (value.kind === 'topic') {
            removeTopic();
            const topic = this.topics?.find(p => p.id === value.param.topicId);
            this.selectTopicOrProject(topic);
          } else if (value.kind === 'project') {
            removeProject();
            const projectResponse = await apiClient.getProject(value.param.projectId);
            const project = await projectResponse.json();
            this.selectTopicOrProject(project);
          } else return;
          if (value.param.viewId) {
            const viewIndex = this.selectedTopicOrProject?.views.findIndex(v => v.id === value.param.viewId);
            if (viewIndex !== -1) DashboardStore.setViewIndex(viewIndex);
          }
          this.hidden = false;
        });
      }));
    const recentlyViewed = localStorage.getItem('dashboard_recently_viewed');
    if (recentlyViewed) {
      this.recentlyViewedIds = JSON.parse(recentlyViewed);
    }
    DashboardStore.selectedTopicOrProject.subscribe(topicOrProject => {
      this.selectedTopicOrProject = topicOrProject;
      if (isProject(topicOrProject)) {
        if (topicOrProject.owner.email === this.userEmail) {
          this.activeTab = 'projects';
        } else {
          this.activeTab = 'shared';
        }
      }
    });
    DashboardStore.viewIndex.subscribe(async viewIndex => {
      await this.selectView(viewIndex);
    });
    MainStore.layersRemoved.subscribe(async () => {
      if (this.selectedViewIndx !== undefined && this.assets) {
        await Promise.all(this.assets.map(async layer => {
          const data = await layer.promise;
          data.show = true;
          this.dispatchEvent(new CustomEvent('layerclick', {
            detail: {layer}
          }));
        }));
      }
    });
    AuthStore.user.subscribe(user => {
      // FIXME: extract from claims
      this.userEmail = user?.username.split('_')[1];
    });
    apiClient.projectsChange.subscribe((projects) => {
      this.refreshProjects(projects);
    });
    DashboardStore.geometriesUpdate.subscribe(geometries => {
      if (this.selectedTopicOrProject) {
        this.selectTopicOrProject({...this.selectedTopicOrProject, geometries});
      } else if (this.projectToCreate) {
        this.projectToCreate = {...this.projectToCreate, geometries};
      }
    });
    apiClient.refreshProjects();

    DashboardStore.onSaveOrCancelWarning.subscribe(show => {
      if (this.projectMode !== 'view') {
        this.saveOrCancelWarning = show;
      }
    });
  }

  refreshProjects(projects: Project[]) {
    this.projects = projects;
    const project = this.projects.find(p => p.id === this.selectedTopicOrProject?.id);
    if (project) {
      this.selectTopicOrProject(project);
    }
  }

  getGeometries(features: Array<GeoJSON.Feature>) {
    return features.map(feature => {
      return Object.assign(fromGeoJSON(feature), {
        editable: false,
        copyable: false,
      });
    });
  }

  async fetchAssets(assets: Asset[]): Promise<Config[]> {
    const assetsData: Config[] = [];
    if (!this.viewer) return assetsData;
    for (const asset of assets) {
      try {
        const href = `${PROJECT_ASSET_URL}${asset.key}`;
        const dataSources = this.viewer.dataSources.getByName(href);
        let uploadedLayer: CustomDataSource;
        if (dataSources.length) {
          uploadedLayer = dataSources[0];
          uploadedLayer.show = true;
        } else {
          const kmlDataSource = await KmlDataSource.load(href, {
            camera: this.viewer.scene.camera,
            canvas: this.viewer.scene.canvas
          });
          uploadedLayer = new CustomDataSource(href);
          let name = kmlDataSource.name;
          kmlDataSource.entities.values.forEach((ent, indx) => {
            if (indx === 0 && !name) {
              name = ent.name!;
            }
            uploadedLayer.entities.add(ent);
          });
          this.assetConfigs[href] = {
            label: name,
            zoomToBbox: true,
            opacity: DEFAULT_LAYER_OPACITY,
            notSaveToPermalink: true,
            topicKml: true
          };
          await this.viewer.dataSources.add(uploadedLayer);
        }
        const promise = Promise.resolve(uploadedLayer);
        assetsData.push({
          ...this.assetConfigs[href],
          displayed: false,
          load() {
            return promise;
          },
          promise
        });
      } catch (e) {
        console.error(e);
        showSnackbarError(i18next.t('dtd_cant_upload_kml_error'));
      }
    }
    return assetsData;
  }

  async selectView(viewIndex: number | undefined) {
    this.selectedViewIndx = viewIndex;
    syncTargetParam(undefined);
    NavToolsStore.nextTargetPointSync();
    if (this.viewer && this.selectedTopicOrProject && viewIndex !== undefined) {
      if (this.selectedTopicOrProject?.assets)
        this.assets = await this.fetchAssets(this.selectedTopicOrProject.assets);
      this.geometries.forEach(geometry => ToolboxStore.setGeometryToCreate(geometry));
      if (!LocalStorageController.storedView) LocalStorageController.storeCurrentView();
      this.dispatchEvent(new CustomEvent('close'));
      const permalink = this.selectedTopicOrProject.views[viewIndex]?.permalink;
      if (permalink) setPermalink(permalink);
    } else if (viewIndex === undefined && LocalStorageController.storedView) {
      this.removeGeometries();
      syncStoredView(LocalStorageController.storedView!);
      LocalStorageController.removeStoredView();
    } else if (viewIndex === undefined && !LocalStorageController.storedView) {
      return;
    }
    await this.setDataFromPermalink();
  }

  selectTopicOrProject(topicOrProject: Topic | Project | undefined) {
    this.selectedTopicOrProject = topicOrProject;
    DashboardStore.setSelectedTopicOrProject(this.selectedTopicOrProject);
    if (topicOrProject) {
      this.addRecentlyViewedTopicOrProject(topicOrProject);
    }
  }

  removeGeometries() {
    this.geometries.forEach(geometry => ToolboxStore.nextGeometryAction({id: geometry.id!, action: 'remove'}));
    this.geometries = [];
  }


  deselectTopicOrProject() {
    this.runIfNotEditCreate(() => {
      this.selectTopicOrProject(undefined);
      this.assets = [];
      this.removeGeometries();
    });
  }

  async setDataFromPermalink() {
    MainStore.nextLayersSync();
    MainStore.nextMapSync();
    const {destination, orientation} = getCameraView();
    if (destination && orientation)
      this.viewer!.camera.flyTo({
        destination: destination,
        orientation: orientation,
        duration: 3,
        complete: () => {
          ToolboxStore.nextSliceSync();
          NavToolsStore.nextTargetPointSync();
        }
      });
  }

  addRecentlyViewedTopicOrProject(data: Topic | Project) {
    this.recentlyViewedIds.unshift(data.id);

    // remove duplicates
    this.recentlyViewedIds = [...new Set(this.recentlyViewedIds)];

    localStorage.setItem('dashboard_recently_viewed', JSON.stringify(this.recentlyViewedIds));
  }

  onProjectDuplicated(project: Project) {
    this.selectTopicOrProject(project);
    this.activeTab = 'projects';
  }

  onProjectCreate() {
    if (!this.userEmail) return;
    this.projectToCreate = {
      color: DEFAULT_PROJECT_COLOR,
      description: '',
      title: '',
      geometries: [],
      assets: [],
      views: [{
        id: '1',
        title: `${i18next.t('dashboard_project_view')} 1`,
        permalink: getPermalink()
      }],
      owner: {
        email: this.userEmail,
        name: this.userEmail.split('@')[0],
        surname: '',
      },
      editors: [],
      viewers: [],
    };
    this.projectMode = 'create';
  }

  onProjectEdit() {
    this.projectMode = 'edit';
  }

  async onProjectSave(project: Project | CreateProject) {
    if (this.projectMode === 'edit' && isProject(project)) {
      this.projectMode = 'view';
    } else if (this.projectMode === 'create' && this.projectToCreate) {
      try {
        const response = await apiClient.createProject(project);
        const id = await response.json();
        const projectResponse = await apiClient.getProject(id);
        const createdProject = await projectResponse.json();
        this.selectTopicOrProject(createdProject);
      } catch (e) {
        console.error(e);
        showSnackbarError(i18next.t('dashboard_project_create_error'));
      }
      this.projectMode = 'view';
      this.projectToCreate = undefined;
    }
    this.saveOrCancelWarning = false;
  }

  cancelEditCreate() {
      apiClient.refreshProjects();
      this.projectMode = 'view';
      this.saveOrCancelWarning = false;
      this.projectToCreate = undefined;
  }

  runIfNotEditCreate(callback: () => void) {
    if (this.projectMode !== 'view') {
      this.saveOrCancelWarning = true;
    } else {
      callback();
    }
  }

  get isProjectSelected() {
    return this.selectedTopicOrProject || this.projectToCreate;
  }

  previewTemplate(proj?: Topic | Project) {
    if (!proj) return '';
    const backgroundImage = proj.image?.length ? `url('${proj.image}')` : 'none';
    return html`
      <div class="ngm-proj-preview" @click=${() => this.selectTopicOrProject(proj)}>
        <div class="ngm-proj-preview-img" style=${styleMap({backgroundImage})}></div>
        <div class="ngm-proj-preview-title" style=${styleMap({backgroundColor: proj.color})}>
          <span>${translated(proj.title)}</span>
        </div>
        <div class="ngm-proj-preview-subtitle">
          <span>${proj.description ? translated(proj.description) : ''}</span>
        </div>
      </div>`;
  }

  recentlyViewedTemplate() {
    if (this.isProjectSelected || this.activeTab === 'projects' || this.activeTab === 'shared' ||
    (this.activeTab === 'overview' && !apiClient.token)) return '';

    const topicsOrProjects = this.activeTab === 'topics' ? this.topics : this.projects;

    const recentlyViewed = this.recentlyViewedIds.map(id => (<any[]> topicsOrProjects)?.find(
      item => item.id === id)).filter(item => item !== undefined);

    return recentlyViewed.length > 0 ? html`
      <div>
        <div class="ngm-proj-title">${i18next.t('dashboard_recently_viewed')}</div>
        <hide-overflow class="ngm-projects-list">
          ${recentlyViewed.map(data => this.previewTemplate(data))}
        </hide-overflow>
      </div>` : html``;
  }

  overviewTemplate() {
    if (this.activeTab === 'overview' && !this.isProjectSelected) {
      if (apiClient.token) {
        return html`
          <div class="ngm-proj-title">${i18next.t('dashboard_my_projects')}</div>
          <hide-overflow class="ngm-projects-list">
            ${this.projects.map(data => this.previewTemplate(data))}
          </hide-overflow>
        `;
      } else {
        showBannerWarning(this.overviewToast, i18next.t('dashboard_overview_not_logged_in'));
      }
    }
    return html``;
  }

  updated(changedProperties: PropertyValues) {
    if (changedProperties.has('projectMode')) {
      DashboardStore.setProjectMode(this.projectMode !== 'view' ? 'edit' : undefined);
    }
    super.updated(changedProperties);
  }

  render() {
    return html`
      <div class="ngm-panel-header">
        <div class="ngm-dashboard-tabs">
          <div class=${classMap({active: this.activeTab === 'topics'})}
               @click=${() => {
                 this.runIfNotEditCreate(() => {
                   this.activeTab = 'topics';
                   this.deselectTopicOrProject();
                 });
                }}>
            ${i18next.t('dashboard_topics')}
          </div>
          <div class=${classMap({active: this.activeTab === 'overview'})}
               @click=${() => {
                 this.runIfNotEditCreate(() => {
                   this.activeTab = 'overview';
                   this.deselectTopicOrProject();
                 });
                }}>
            ${i18next.t('dashboard_overview')}
          </div>
          <div class=${classMap({active: this.activeTab === 'projects'})}
                ?hidden=${!apiClient.token}
               @click=${() => {
                 this.runIfNotEditCreate(() => {
                   this.activeTab = 'projects';
                   this.deselectTopicOrProject();
                 });
               }}>${i18next.t('dashboard_my_projects')}
              (${this.projects.filter(p => p.owner.email === this.userEmail).length})
          </div>
          <div class=${classMap({active: this.activeTab === 'shared'})}
               ?hidden=${!apiClient.token}
               @click=${() => {
                 this.runIfNotEditCreate(() => {
                   this.activeTab = 'shared';
                   this.deselectTopicOrProject();
                 });
               }}>${i18next.t('dashboard_shared_projects')}
              (${this.projects.filter(p => p.owner.email !== this.userEmail).length})
          </div>
        </div>
        <div class="ngm-close-icon" @click=${() => {
          this.runIfNotEditCreate(() => this.dispatchEvent(new CustomEvent('close')));
        }}></div>
      </div>
      <div class="ngm-panel-content">
        <div class="ngm-toast-placeholder"></div>
        ${this.recentlyViewedTemplate()}
        <div ?hidden=${this.activeTab !== 'topics' || this.isProjectSelected}>
          <div class="ngm-proj-title">${i18next.t('dashboard_recent_swisstopo')}</div>
          <div class="ngm-projects-list">
            ${this.topics?.map(data => this.previewTemplate(data))}
          </div>
        </div>
        <div>
          <div class="ngm-toast-placeholder" id="overview-toast" ?hidden=${!!apiClient.token}></div>
          ${this.overviewTemplate()}
        </div>
        <div ?hidden=${this.activeTab !== 'projects' || this.isProjectSelected}>
          <div class="ngm-proj-title">${i18next.t('dashboard_my_projects')}</div>
          <div class="ngm-projects-list">
            ${this.projects.filter(p => p.owner.email === this.userEmail).map(data => this.previewTemplate(data))}
            <div class="ngm-proj-preview ngm-proj-create" @click=${() => this.onProjectCreate()}>
              <div class="ngm-zoom-p-icon"></div>
              <div>${i18next.t('dashboard_project_create_btn')}</div>
            </div>
          </div>
        </div>
        <div ?hidden=${this.activeTab !== 'shared' || this.isProjectSelected}>
          <div class="ngm-proj-title">${i18next.t('dashboard_shared_projects')}</div>
          <div class="ngm-projects-list">
            ${this.projects.filter(p => p.owner.email !== this.userEmail).map(data => this.previewTemplate(data))}
          </div>
        </div>
        <div ?hidden=${!this.isProjectSelected}>
          ${this.projectMode !== 'view' ?
              html`<ngm-project-edit 
                     .project="${this.projectMode === 'create' ? this.projectToCreate : this.selectedTopicOrProject}" 
                     .saveOrCancelWarning="${this.saveOrCancelWarning}"
                     .createMode="${this.projectMode === 'create'}"
                     .userEmail="${this.userEmail}"
                     @onBack=${this.deselectTopicOrProject}
                     @onSave="${async (evt: {detail: {project: Project}}) => this.onProjectSave(evt.detail.project)}"
                     @onCancel="${this.cancelEditCreate}"></ngm-project-edit>` :
              html`<ngm-project-topic-overview
                     .topicOrProject="${this.selectedTopicOrProject}"
                     .toastPlaceholder="${this.toastPlaceholder}"
                     .activeTab="${this.activeTab}"
                     .selectedViewIndx="${this.selectedViewIndx}"
                     .userEmail="${this.userEmail}"
                     @onDeselect="${this.deselectTopicOrProject}"
                     @onEdit="${this.onProjectEdit}"
                     @onProjectDuplicated="${(evt: {detail: {project: Project}}) => this.onProjectDuplicated(evt.detail.project)}"
                     @onProjectDeleted="${() => this.deselectTopicOrProject()}"
                    ></ngm-project-topic-overview>`}
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
