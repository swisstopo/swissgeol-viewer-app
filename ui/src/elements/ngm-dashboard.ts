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
import {showBannerSuccess, showSnackbarError} from '../notifications';
import type {Config} from '../layers/ngm-layers-item';
import {DEFAULT_LAYER_OPACITY, RECENTLY_VIEWED_TOPICS_COUNT, RECENTLY_VIEWED_TOPICS_COUNT_MOBILE} from '../constants';
import $ from '../jquery';
import {fromGeoJSON} from '../toolbox/helpers';
import type {NgmGeometry} from '../toolbox/interfaces';

export interface TranslatedText {
  de: string,
  fr: string,
  it: string,
  en: string,
}

export interface DashboardProjectView {
  id: string,
  title: TranslatedText,
  permalink: string,
}

export interface Asset {
  href: string,
}

export interface DashboardProject {
  id: string,
  title: TranslatedText,
  description: TranslatedText,
  created: string,
  modified: string,
  image: string,
  color: string,
  views: DashboardProjectView[],
  assets: Map<string, Asset> | undefined,
  geometries: Array<GeoJSON.Feature> | undefined,
}

@customElement('ngm-dashboard')
export class NgmDashboard extends LitElementI18n {
  @property({type: Boolean}) hidden = true;
  @property({type: Boolean}) mobileView = false;
  @state() activeTab: 'topics' | 'project' = 'topics';
  @state() selectedProject: DashboardProject | undefined;
  @state() projects: DashboardProject[] | undefined;
  @state() selectedViewIndx: number | undefined;
  @query('.ngm-toast-placeholder') toastPlaceholder;
  private viewer: Viewer | null = null;
  private assetConfigs: any = {};
  private assets: Config[] | undefined;
  private geometries: NgmGeometry[] = [];
  private recentlyViewed: Array<number> = [];

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
    fetch('./src/sampleData/topics.json').then(topicsResponse =>
      topicsResponse.json().then(topics => {
        this.projects = topics;
        // sort by newest first
        this.projects?.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
        const recentlyViewed = localStorage.getItem('recentlyViewedTopics');
        if (recentlyViewed) {
          this.recentlyViewed = JSON.parse(recentlyViewed);
        }
        DashboardStore.topicParam.subscribe(async param => {
          if (!param) return;
          const {viewId, topicId} = param;
          removeTopic();
          const project = this.projects?.find(p => p.id === topicId);
          await this.selectProject(project);
          if (viewId) {
            const viewIndex = this.selectedProject?.views.findIndex(v => v.id === viewId);
            if (viewIndex !== -1)
              DashboardStore.setViewIndex(viewIndex);
          }
          this.hidden = false;
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
    if ((changedProperties.has('selectedProject') || changedProperties.has('hidden')) && this.selectedProject) {
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

  async fetchAssets(assets: Map<string, Asset>): Promise<Config[]> {
    const assetsData: Config[] = [];
    if (!this.viewer) return assetsData;
    for (const asset of Object.values(assets)) {
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
    if (this.viewer && this.selectedProject && viewIndex !== undefined) {
      if (this.selectedProject?.assets)
        this.assets = await this.fetchAssets(this.selectedProject.assets);
      this.geometries.forEach(geometry => ToolboxStore.setGeometryToCreate(geometry));
      if (!LocalStorageController.storedView) LocalStorageController.storeCurrentView();
      this.dispatchEvent(new CustomEvent('close'));
      const permalink = this.selectedProject.views[viewIndex].permalink;
      setPermalink(permalink);
    } else if (viewIndex === undefined) {
      this.geometries.forEach(geometry => ToolboxStore.nextGeometryAction({id: geometry.id!, action: 'remove'}));
      syncStoredView(LocalStorageController.storedView);
      LocalStorageController.removeStoredView();
    }
    await this.setDataFromPermalink();
  }

  async selectProject(project: DashboardProject) {
    this.selectedProject = project;
    if (this.selectedProject.geometries) {
      this.geometries = this.getGeometries(this.selectedProject.geometries);
    }
    DashboardStore.setSelectedProject(this.selectedProject);
    this.addRecentlyViewed(project);
  }

  deselectProject() {
    this.selectedProject = undefined;
    this.assets = [];
    this.geometries = [];
    DashboardStore.setSelectedProject(undefined);
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

  addRecentlyViewed(data: DashboardProject) {
    if (!this.projects) return;
    const index = this.projects.indexOf(data);
    this.recentlyViewed.unshift(index);

    // remove duplicates
    this.recentlyViewed = [...new Set(this.recentlyViewed)];

    if (this.recentlyViewed.length > RECENTLY_VIEWED_TOPICS_COUNT) {
      this.recentlyViewed.length = RECENTLY_VIEWED_TOPICS_COUNT;
    }
    localStorage.setItem('recentlyViewedTopics', JSON.stringify(this.recentlyViewed));
  }

  getLink(viewId?: string): string | undefined {
    if (!this.selectedProject) return;
    let link = `${location.protocol}//${location.host}${location.pathname}?topicId=${this.selectedProject.id}`;
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

  contextMenu(viewId?) {
    return html`
      <div class="menu">
        <div class="item"
             @click=${() => this.copyLink(viewId)}>
          ${i18next.t('dashboard_share_topic')}
        </div>
        <a class="item" target="_blank" href="mailto:?body=${encodeURIComponent(this.getLink(viewId) || '')}">
          ${i18next.t('dashboard_share_topic_email')}
        </a>
      </div>
    `;
  }

  previewTemplate(proj) {
    if (!proj) return '';
    return html`
      <div class="ngm-proj-preview" @click=${() => this.selectProject(proj)}>
        <div class="ngm-proj-preview-img" style=${styleMap({backgroundImage: `url('${proj.image}')`})}></div>
        <div class="ngm-proj-preview-title" style=${styleMap({backgroundColor: proj.color})}>
          <span>${translated(proj.title)}</span>
        </div>
        <div class="ngm-proj-preview-subtitle"><span>${translated(proj.description)}</span></div>
      </div>`;
  }

  projectTabTemplate() {
    if (!this.selectedProject) return '';
    return html`
      <div>
        <div class="ngm-proj-title">
          ${translated(this.selectedProject.title)}
          <div class="ui dropdown right pointing ngm-action-menu">
            <div class="ngm-view-icon ngm-action-menu-icon"></div>
            ${this.contextMenu()}
          </div>
        </div>
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
      <div class="ngm-label-btn" @click=${this.deselectProject}>
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
                 this.deselectProject();
               }}>
            ${i18next.t('dashboard_topics')}
          </div>
        </div>
        <div class="ngm-close-icon" @click=${() => this.dispatchEvent(new CustomEvent('close'))}></div>
      </div>
      <div class="ngm-toast-placeholder"></div>
      <div ?hidden=${this.selectedProject || this.recentlyViewed.length === 0}>
        <div class="ngm-proj-title">${i18next.t('dashboard_recently_viewed')}</div>
        <div class="ngm-projects-list">
          ${fromIndexes(this.projects, this.recentlyViewed)
            .slice(0, this.mobileView ? RECENTLY_VIEWED_TOPICS_COUNT_MOBILE : undefined)
            .map(data => this.previewTemplate(data))
          }
        </div>
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


function fromIndexes(arr: any[], indexes: number[]): any[] {
  const result: any[] = [];
  for (let i = 0; i < indexes.length; i++) {
    result.push(arr[indexes[i]]);
  }
  return result;
}
