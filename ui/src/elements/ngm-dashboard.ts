import {LitElementI18n, toLocaleDateString} from '../i18n';
import {customElement, property, query, state} from 'lit/decorators.js';
import {html} from 'lit';
import i18next from 'i18next';
import {styleMap} from 'lit/directives/style-map.js';
import {classMap} from 'lit-html/directives/class-map.js';
import MainStore from '../store/main';
import ToolboxStore from '../store/toolbox';
import {getCameraView, removeTopic, setPermalink, syncStoredView, syncTargetParam} from '../permalink';
import NavToolsStore from '../store/navTools';
import DashboardStore from '../store/dashboard';
import LocalStorageController from '../LocalStorageController';
import type {Viewer} from 'cesium';
import {CustomDataSource, KmlDataSource} from 'cesium';
import {showBannerSuccess, showSnackbarError, showBannerWarning} from '../notifications';
import type {Config} from '../layers/ngm-layers-item';
import {DEFAULT_LAYER_OPACITY, RECENTLY_VIEWED_TOPICS_COUNT, RECENTLY_VIEWED_TOPICS_COUNT_MOBILE} from '../constants';
import $ from '../jquery';
import {fromGeoJSON} from '../toolbox/helpers';
import type {NgmGeometry} from '../toolbox/interfaces';
import {ApiClient} from '../apiClient';
import Auth, {getAccessToken} from '../auth';
import AuthStore from '../store/auth';


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
  geometries?: Array<GeoJSON.Feature>,
}

export interface Project extends Topic {
  owner: string,
  members: string[],
  viewers: string[],
}


@customElement('ngm-dashboard')
export class NgmDashboard extends LitElementI18n {
  @property({type: Boolean}) hidden = true;
  @property({type: Boolean}) mobileView = false;
  @state() activeTab: 'topics' | 'overview' | 'projects' = 'topics';
  @state() selectedTopicOrProject: Topic | Project | undefined;
  @state() topics: Topic[] | undefined;
  @state() selectedViewIndx: number | undefined;
  @state() refreshProjects = true;
  @query('.ngm-toast-placeholder') toastPlaceholder;
  @query('#overview-toast') overviewToast;
  private viewer: Viewer | null = null;
  private assetConfigs: any = {};
  private assets: Config[] | undefined;
  private geometries: NgmGeometry[] = [];
  private recentlyViewedIds: Array<string> = [];
  private projects: Project[] = [];
  private apiClient: ApiClient = new ApiClient();

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
    fetch('./src/sampleData/topics.json').then(topicsResponse =>
      topicsResponse.json().then(topics => {
        this.topics = topics;
        // sort by newest first
        this.topics?.sort((a, b) => new Date(a.modified).getTime() - new Date(b.modified).getTime());
        const recentlyViewed = localStorage.getItem('dashbord_recently_viewed');
        if (recentlyViewed) {
          this.recentlyViewedIds = JSON.parse(recentlyViewed);
        }
        DashboardStore.topicParam.subscribe(async param => {
          if (!param) return;
          const {viewId, topicId} = param;
          removeTopic();
          const topic = this.topics?.find(p => p.id === topicId);
          await this.selectTopicOrProject(topic!);
          if (viewId) {
            const viewIndex = this.selectedTopicOrProject?.views.findIndex(v => v.id === viewId);
            if (viewIndex !== -1)
              DashboardStore.setViewIndex(viewIndex);
          }
          this.hidden = false;
        });
        AuthStore.user.subscribe(() => {
          this.apiClient.token = Auth.getAccessToken();
          this.refreshProjects = true;
        });
      }));
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
  }

  updated(changedProperties) {
    if ((changedProperties.has('selectedTopic') || changedProperties.has('hidden')) && this.selectedTopicOrProject) {
      this.querySelectorAll('.ui.dropdown').forEach(elem => $(elem).dropdown());
    }
    super.updated(changedProperties);
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
      syncStoredView(LocalStorageController.storedView);
      LocalStorageController.removeStoredView();
    }
    await this.setDataFromPermalink();
  }

  async selectTopicOrProject(topic: Topic | Project) {
    this.selectedTopicOrProject = topic;
    if (this.selectedTopicOrProject.geometries) {
      this.geometries = this.getGeometries(this.selectedTopicOrProject.geometries);
    }
    DashboardStore.setSelectedTopicOrProject(this.selectedTopicOrProject);
    this.addRecentlyViewedTopicOrProject(topic);
  }

  removeGeometries() {
    this.geometries.forEach(geometry => ToolboxStore.nextGeometryAction({id: geometry.id!, action: 'remove'}));
    this.geometries = [];
  }


  deselectTopicOrProject() {
    this.selectedTopicOrProject = undefined;
    this.assets = [];
    this.removeGeometries();
    DashboardStore.setSelectedTopicOrProject(undefined);
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

    if (this.recentlyViewedIds.length > 2 * RECENTLY_VIEWED_TOPICS_COUNT) {
      this.recentlyViewedIds.length = 2 * RECENTLY_VIEWED_TOPICS_COUNT;
    }
    localStorage.setItem('dashbord_recently_viewed', JSON.stringify(this.recentlyViewedIds));
  }

  getLink(viewId?: string): string | undefined {
    if (!this.selectedTopicOrProject) return;
    let link = `${location.protocol}//${location.host}${location.pathname}?topicId=${this.selectedTopicOrProject.id}`;
    if (viewId) link = `${link}&viewId=${viewId}`;
    return link;
  }

  async copyLink(viewId?: string) {
    try {
      const link = this.getLink(viewId);
      if (link) await navigator.clipboard.writeText(link);
      showBannerSuccess(this.toastPlaceholder, i18next.t('shortlink_copied'));
    } catch (e) {
      console.error(e);
    }
  }

  topicToProject(topic: Topic): Project {
    const now = new Date().toISOString();
    const project: Project = {
      id: '5d700000-0000-0000-0000-000000000000',
      color: topic.color,
      description: translated(topic.description),
      title: translated(topic.title),
      image: topic.image,
      created: now, // make linter happy
      modified: now, // make linter happy
      geometries: topic.geometries, // not a copy
      assets: topic.assets, // not a copy
      views: topic.views.map(view => ({
        id: view.id,
        title: translated(view.title),
        permalink: view.permalink
      })
      ),
      members: [],
      owner: 'to repace',
      viewers: [],
    };
    return project;
  }

  async duplicateToProject() {
    const topicId = this.selectedTopicOrProject!.id;
    const topic = this.topics!.find(p => p.id === topicId);
    const project = this.topicToProject(topic!);

    this.apiClient.duplicateProject(project).then(r => r.json())
      .then(id => {
        this.apiClient.getProject(id).then(r => r.json()).then(project => {
          this.selectedTopicOrProject = project;
          this.activeTab = 'projects';
          this.refreshProjects = true;
        });
      });
  }

  contextMenu(viewId?) {
    return html`
      <div class="menu">
        <div class="item"
             @click=${() => this.copyLink(viewId)}>
          ${i18next.t('dashboard_share_topic')}
        </div>
        <div class="item"
             @click=${() => this.duplicateToProject()}>
          ${i18next.t('duplicate_to_project')}
        </div>
        <a class="item" target="_blank" href="mailto:?body=${encodeURIComponent(this.getLink(viewId) || '')}">
          ${i18next.t('dashboard_share_topic_email')}
        </a>
      </div>
    `;
  }

  previewTemplate(proj?: Topic | Project) {
    if (!proj) return '';
    return html`
      <div class="ngm-proj-preview" @click=${() => this.selectTopicOrProject(proj)}>
        <div class="ngm-proj-preview-img" style=${styleMap({backgroundImage: `url('${proj.image}')`})}></div>
        <div class="ngm-proj-preview-title" style=${styleMap({backgroundColor: proj.color})}>
          <span>${translated(proj.title)}</span>
        </div>
        <div class="ngm-proj-preview-subtitle"><span>${translated(proj.description)}</span></div>
      </div>`;
  }

  projectTabTemplate() {
    if (!this.selectedTopicOrProject) return '';
    return html`
      <div>
        <div class="ngm-proj-title">
          ${translated(this.selectedTopicOrProject.title)}
          <div class="ui dropdown right pointing ngm-action-menu">
            <div class="ngm-view-icon ngm-action-menu-icon"></div>
            ${this.contextMenu()}
          </div>
        </div>
        <div class="ngm-proj-data">
          ${`${i18next.t('dashboard_modified_title')} ${toLocaleDateString(this.selectedTopicOrProject.modified)} ${i18next.t('dashboard_by_swisstopo_title')}`}
        </div>
        <div class="ngm-proj-information">
          <div>
            <div class="ngm-proj-preview-img"
                 style=${styleMap({backgroundImage: `url('${this.selectedTopicOrProject.image}')`})}></div>
            <div class="ngm-proj-preview-title" style=${styleMap({backgroundColor: this.selectedTopicOrProject.color})}></div>
          </div>
          <div class="ngm-proj-description">
            <div class="ngm-proj-description-title">${i18next.t('dashboard_description')}</div>
            <div class="ngm-proj-description-content">${translated(this.selectedTopicOrProject.description)}</div>
          </div>
        </div>
      </div>
      <div class="ngm-divider"></div>
      <div class="ngm-proj-views-title">
        <div class="ngm-screenshot-icon"></div>
        <div>${i18next.t('dashboard_views')}</div>
      </div>
      <div class="ngm-project-views">
        ${this.selectedTopicOrProject.views.map((view, index) => html`
          <div class="ngm-action-list-item ${classMap({active: this.selectedViewIndx === index})}">
            <div class="ngm-action-list-item-header">
              <div @click=${() => DashboardStore.setViewIndex(this.selectedViewIndx === index ? undefined : index)}>
                ${translated(view.title)}
              </div>
              <div title="${i18next.t('dashboard_share_topic')}"
                   class="ngm-view-icon ngm-share-icon"
                   @click=${() => this.copyLink(view.id)}></div>
            </div>
          </div>
        `)}
      </div>
      <div class="ngm-divider"></div>
      <div class="ngm-label-btn" @click=${this.deselectTopicOrProject}>
        <div class="ngm-back-icon"></div>
        ${i18next.t('dashboard_back_to_topics')}
      </div>
    `;
  }

  recentlyViewedTemplate() {
    if (this.selectedTopicOrProject || this.activeTab === 'projects') return '';

    const topicsOrProjects = this.activeTab === 'topics' ? this.topics : this.projects;

    const recentlyViewed = this.recentlyViewedIds.map(id => topicsOrProjects?.find(item => item.id === id)).filter(item => item !== undefined);

    return recentlyViewed.length > 0 ? html`
      <div>
        <div class="ngm-proj-title">${i18next.t('dashboard_recently_viewed')}</div>
        <div class="ngm-projects-list">
          ${recentlyViewed.slice(0, this.mobileView ? RECENTLY_VIEWED_TOPICS_COUNT_MOBILE : RECENTLY_VIEWED_TOPICS_COUNT)
            .map(data => this.previewTemplate(data))}
        </div>
      </div>` : html``;
  }

  overviewTemplate() {
    if (this.activeTab === 'overview' && !this.selectedTopicOrProject) {
      if (this.apiClient.token) {
        return html`
          <div class="ngm-proj-title">${i18next.t('dashboard_my_projects')}</div>
          <div class="ngm-projects-list">
            ${this.projects.slice(0, this.mobileView ? RECENTLY_VIEWED_TOPICS_COUNT_MOBILE : RECENTLY_VIEWED_TOPICS_COUNT - 1)
              .map(data => this.previewTemplate(data))}
          </div>
        `;
      } else {
        showBannerWarning(this.overviewToast, i18next.t('dashboard_overview_not_logged_in'));
      }
    }
    return html``;
  }

  render() {
    if (!this.topics) return '';
    // TODO: Syncronize logged in user token with dashboard and client.
    if (this.refreshProjects) {
      this.apiClient.token = getAccessToken();
      if (this.apiClient.token) {
        this.apiClient.getProjects().then(response => response.json()).then(body => {
          this.projects = body;
        });
      }
      this.refreshProjects = false;
    }

    return html`
      <div class="ngm-panel-header">
        <div class="ngm-dashboard-tabs">
          <div class=${classMap({active: this.activeTab === 'topics'})}
               @click=${() => {
                  this.activeTab = 'topics';
                  this.deselectTopicOrProject();
                }}>
            ${i18next.t('dashboard_topics')}
          </div>
          <div class=${classMap({active: this.activeTab === 'overview'})}
               @click=${() => {
                  this.activeTab = 'overview';
                  this.deselectTopicOrProject();
                }}>
            ${i18next.t('dashboard_overview')}
          </div>
          <div class=${classMap({active: this.activeTab === 'projects'})}
                ?hidden=${!this.apiClient.token}
               @click=${() => {
                  this.activeTab = 'projects';
                  this.deselectTopicOrProject();
                }}>
            ${i18next.t('dashboard_my_projects')} (${this.projects.length})
          </div>
        </div>
        <div class="ngm-close-icon" @click=${() => this.dispatchEvent(new CustomEvent('close'))}></div>
      </div>
      <div class="ngm-toast-placeholder"></div>
      ${this.recentlyViewedTemplate()}
      <div ?hidden=${this.activeTab !== 'topics' || this.selectedTopicOrProject}>
        <div class="ngm-proj-title">${i18next.t('dashboard_recent_swisstopo')}</div>
        <div class="ngm-projects-list">
          ${this.topics.map(data => this.previewTemplate(data))}
        </div>
      </div>
      <div>
        <div class="ngm-toast-placeholder" id="overview-toast" ?hidden=${this.apiClient.token}></div>
        ${this.overviewTemplate()}
      </div>
      <div ?hidden=${this.activeTab !== 'projects' || this.selectedTopicOrProject}>
        <div class="ngm-proj-title">${i18next.t('dashboard_my_projects')}</div>
        <div class="ngm-projects-list">
          ${this.projects.map(data => this.previewTemplate(data))}
        </div>
      </div>
      <div ?hidden=${!this.selectedTopicOrProject}>
        ${this.projectTabTemplate()}
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}


function translated(property: TextualAttribute): string {
  return typeof property === 'string' ? property : property[i18next.language];
}
