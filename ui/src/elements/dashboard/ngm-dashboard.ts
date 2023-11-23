import {LitElementI18n, translated} from '../../i18n';
import {customElement, property, query, state} from 'lit/decorators.js';
import {html, PropertyValues} from 'lit';
import i18next from 'i18next';
import {styleMap} from 'lit/directives/style-map.js';
import {classMap} from 'lit-html/directives/class-map.js';
import MainStore from '../../store/main';
import ToolboxStore from '../../store/toolbox';
import {getCameraView, getPermalink, removeTopic, setPermalink, syncStoredView, syncTargetParam} from '../../permalink';
import NavToolsStore from '../../store/navTools';
import DashboardStore from '../../store/dashboard';
import LocalStorageController from '../../LocalStorageController';
import type {Viewer} from 'cesium';
import {CustomDataSource, KmlDataSource} from 'cesium';
import {showSnackbarError, showBannerWarning} from '../../notifications';
import type {Config} from '../../layers/ngm-layers-item';
import {DEFAULT_LAYER_OPACITY, DEFAULT_PROJECT_COLOR} from '../../constants';
import {fromGeoJSON} from '../../toolbox/helpers';
import type {NgmGeometry} from '../../toolbox/interfaces';
import {apiClient} from '../../api-client';
import AuthStore from '../../store/auth';
import '../hide-overflow';
import './ngm-project-edit';
import './ngm-project-topic-overview';

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
  href: string,
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
  owner: string,
  members: string[],
  viewers: string[],
}

export interface Project extends CreateProject {
  id: string,
  created: string,
  modified: string,
}

export type TabTypes = 'topics' | 'overview' | 'projects';

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
  accessor projectEditMode = false;
  @state()
  accessor projectCreateMode = false;
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
        DashboardStore.topicParam.subscribe(async param => {
          if (!param) return;
          const {viewId, topicId} = param;
          removeTopic();
          const topic = this.topics?.find(p => p.id === topicId);
          if (!topic) return;
          this.selectTopicOrProject(topic);
          if (viewId) {
            const viewIndex = this.selectedTopicOrProject?.views.findIndex(v => v.id === viewId);
            if (viewIndex !== -1)
              DashboardStore.setViewIndex(viewIndex);
          }
          this.hidden = false;
        });
      }));
    const recentlyViewed = localStorage.getItem('dashboard_recently_viewed');
    if (recentlyViewed) {
      this.recentlyViewedIds = JSON.parse(recentlyViewed);
    }
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
    apiClient.projectsChange.subscribe(() => {
      apiClient.getProjects()
        .then(response => response.json())
        .then(body => this.projects = body);
      const project = this.projects.find(p => p.id === this.selectedTopicOrProject?.id);
      if (project) {this.selectedTopicOrProject = project;}
    });
    this.refreshProjects();
  }

  refreshProjects() {
    if (apiClient.token) {
      apiClient.getProjects()
          .then(response => response.json())
          .then(body => this.projects = body);
      const project = this.projects.find(p => p.id === this.selectedTopicOrProject?.id);
      if (project) {
        this.selectedTopicOrProject = project;
      }
    }
  }

  getGeometries(features: Array<GeoJSON.Feature>) {
    return features.map(feature => {
      return Object.assign(fromGeoJSON(feature), {
        fromTopic: true,
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
        const dataSources = this.viewer.dataSources.getByName(asset.href);
        let uploadedLayer: CustomDataSource;
        if (dataSources.length) {
          uploadedLayer = dataSources[0];
          uploadedLayer.show = true;
        } else {
          const kmlDataSource = await KmlDataSource.load(asset.href, {
            camera: this.viewer.scene.camera,
            canvas: this.viewer.scene.canvas
          });
          uploadedLayer = new CustomDataSource(asset.href);
          let name = kmlDataSource.name;
          kmlDataSource.entities.values.forEach((ent, indx) => {
            if (indx === 0 && !name) {
              name = ent.name!;
            }
            uploadedLayer.entities.add(ent);
          });
          this.assetConfigs[asset.href] = {
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
          ...this.assetConfigs[asset.href],
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
      const permalink = this.selectedTopicOrProject.views[viewIndex].permalink;
      setPermalink(permalink);
    } else if (viewIndex === undefined) {
      this.removeGeometries();
      syncStoredView(LocalStorageController.storedView!);
      LocalStorageController.removeStoredView();
    }
    await this.setDataFromPermalink();
  }

  selectTopicOrProject(topic: Topic | Project) {
    this.selectedTopicOrProject = topic;
    DashboardStore.setSelectedTopicOrProject(this.selectedTopicOrProject);
    this.addRecentlyViewedTopicOrProject(topic);
  }

  removeGeometries() {
    this.geometries.forEach(geometry => ToolboxStore.nextGeometryAction({id: geometry.id!, action: 'remove'}));
    this.geometries = [];
  }


  deselectTopicOrProject() {
    this.runIfNotEditCreate(() => {
      this.selectedTopicOrProject = undefined;
      this.assets = [];
      this.removeGeometries();
      DashboardStore.setSelectedTopicOrProject(undefined);
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
      owner: this.userEmail,
      members: [],
      viewers: [],
    };
    this.projectCreateMode = true;
  }

  onProjectEdit() {
    this.projectEditMode = true;
  }

  async onProjectSave(project: Project) {
    if (this.projectEditMode) {
      await apiClient.updateProject(project);
      this.projectEditMode = false;
    } else if (this.projectCreateMode && this.projectToCreate) {
      try {
        const response = await apiClient.createProject(this.projectToCreate);
        const id = await response.json();
        const projectResponse = await apiClient.getProject(id);
        const project = await projectResponse.json();
        this.selectTopicOrProject(project);
      } catch (e) {
        console.error(e);
        showSnackbarError(i18next.t('dashboard_project_create_error'));
      }
      this.projectCreateMode = false;
      this.projectToCreate = undefined;
    }
    this.saveOrCancelWarning = false;
  }

  cancelEditCreate() {
      this.refreshProjects();
      this.projectEditMode = false;
      this.projectCreateMode = false;
      this.saveOrCancelWarning = false;
      this.projectToCreate = undefined;
  }

  runIfNotEditCreate(callback: () => void) {
    if (this.projectEditMode || this.projectCreateMode) {
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
    if (this.isProjectSelected || this.activeTab === 'projects' ||
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
    if (changedProperties.has('projectEditMode')) {
      DashboardStore.setEditMode(this.projectEditMode);
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
                }}>
            ${i18next.t('dashboard_my_projects')} (${this.projects.length})
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
            ${this.projects.map(data => this.previewTemplate(data))}
            <div class="ngm-proj-preview ngm-proj-create" @click=${() => this.onProjectCreate()}>
              <div class="ngm-zoom-p-icon"></div>
              <div>${i18next.t('dashboard_project_create_btn')}</div>
            </div>
          </div>
        </div>
        <div ?hidden=${!this.isProjectSelected}>
          ${this.projectEditMode || this.projectCreateMode ?
              html`<ngm-project-edit 
                     .project="${this.projectCreateMode ? this.projectToCreate : this.selectedTopicOrProject}" 
                     .saveOrCancelWarning="${this.saveOrCancelWarning}"
                     .createMode="${this.projectCreateMode}"
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
                    ></ngm-project-topic-overview>`}
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
