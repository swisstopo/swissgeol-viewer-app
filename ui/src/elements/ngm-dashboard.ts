import {LitElementI18n, toLocaleDateString, translated} from '../i18n';
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
import {COLORS_WITH_BLACK_TICK, DEFAULT_LAYER_OPACITY, PROJECT_COLORS} from '../constants';
import $ from '../jquery';
import {fromGeoJSON} from '../toolbox/helpers';
import type {NgmGeometry} from '../toolbox/interfaces';
import {apiClient} from '../api-client';
import AuthStore from '../store/auth';
import './hide-overflow';

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

export interface CreateProject {
  title: string,
  description?: string,
  image?: string,
  color: string,
  views: View[],
  assets: Asset[],
  geometries?: Array<GeoJSON.Feature>,
  owner: string,
  members: string[],
  viewers: string[],
}

export interface Project extends CreateProject {
  id: string,
  created: string,
  modified: string,
}

@customElement('ngm-dashboard')
export class NgmDashboard extends LitElementI18n {
  @property({type: Boolean}) hidden = true;
  @state() projects: Project[] = [];
  @state() activeTab: 'topics' | 'overview' | 'projects' = 'topics';
  @state() selectedTopicOrProject: Topic | Project | undefined;
  @state() topics: Topic[] | undefined;
  @state() selectedViewIndx: number | undefined;
  @state() projectEditing = false;
  @state() saveOrCancelWarning = false;
  @query('.ngm-toast-placeholder') toastPlaceholder;
  @query('#overview-toast') overviewToast;
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
        this.topics = topics.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
      }));
    const recentlyViewed = localStorage.getItem('dashboard_recently_viewed');
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

  updated(changedProperties) {
    if (((changedProperties.has('selectedTopicOrProject') || changedProperties.has('hidden')
          ) && this.selectedTopicOrProject
        ) || this.projectEditing) {
      this.querySelectorAll('.ui.dropdown').forEach(elem => $(elem).dropdown());
    }
    super.updated(changedProperties);
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

    localStorage.setItem('dashboard_recently_viewed', JSON.stringify(this.recentlyViewedIds));
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

  toCreateProject(project: Topic | Project): CreateProject {
    const createProject: CreateProject = {
      color: '#B0BEC5',
      description: project.description ? translated(project.description) : undefined,
      title: translated(project.title),
      geometries: project.geometries, // not a copy
      assets: project.assets, // not a copy
      views: project.views.map(view => ({
        id: crypto.randomUUID(),
        title: translated(view.title),
        permalink: view.permalink
      })),
      owner: this.userEmail!,
      members: [],
      viewers: [],
    };
    return createProject;
  }

  async duplicateToProject() {
    const createProject = this.toCreateProject(this.selectedTopicOrProject!);

    apiClient.duplicateProject(createProject).then(r => r.json())
      .then(id => {
        apiClient.getProject(id).then(r => r.json()).then(async project => {
          await this.selectTopicOrProject(project);
          // this.selectedTopicOrProject = project;
          this.activeTab = 'projects';
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
        <div class="item ${apiClient.token ? '' : 'disabled'}"
             ?hidden=${this.activeTab !== 'topics'}
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
        <div class="ngm-proj-preview-subtitle">
          <span>${proj.description ? translated(proj.description) : ''}</span>
        </div>
      </div>`;
  }

  projectTabTemplate() {
    if (!this.selectedTopicOrProject) return '';

    const owner = (<Project> this.selectedTopicOrProject).owner ? (<Project> this.selectedTopicOrProject).owner : i18next.t('swisstopo');
    const date = this.selectedTopicOrProject?.modified ? this.selectedTopicOrProject?.modified : this.selectedTopicOrProject?.created;

    return html`
      <div>
        <div class="ngm-proj-title">
          ${translated(this.selectedTopicOrProject.title)}
          <div class="project-menu">
            <div class="edit-project"
                ?hidden=${this.activeTab === 'topics' || ![(<Project> this.selectedTopicOrProject).owner, ...(<Project> this.selectedTopicOrProject).members].includes(this.userEmail!)}
                @click=${() => this.projectEditing = true}>
              ${i18next.t('edit_project')}<div class="ngm-edit-icon"></div>
            </div>
            <div class="ui dropdown right pointing ngm-action-menu">
              <div class="ngm-view-icon ngm-action-menu-icon"></div>
            ${this.contextMenu()}
            </div>
          </div>
        </div>
        <div class="ngm-proj-data">${
          `${this.selectedTopicOrProject.modified ? i18next.t('modified_on') : i18next.t('created_on')} ${toLocaleDateString(date)} ${i18next.t('by')} ${owner}`
        }</div>
        <div class="ngm-proj-information">
          <div>
            <div class="ngm-proj-preview-img"
                 style=${styleMap({backgroundImage: `url('${this.selectedTopicOrProject.image}')`})}></div>
            <div class="ngm-proj-preview-title" style=${styleMap({backgroundColor: this.selectedTopicOrProject.color})}></div>
          </div>
          <div class="ngm-proj-description">
            <div class="ngm-proj-description-title">${i18next.t('dashboard_description')}</div>
            <div class="ngm-proj-description-content">${
              this.selectedTopicOrProject.description ? translated(this.selectedTopicOrProject.description) : ''
            }</div>
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

  projectEditingTemplate() {
    const project: Project = <Project> this.selectedTopicOrProject;

    return html`
      <div>
        <div class="ui warning message" ?hidden=${!this.saveOrCancelWarning}>
          ${i18next.t('project_lost_changes_warning')}
        </div>
        <div class="ngm-proj-title">
          <div class="ngm-input project-title ${classMap({'ngm-input-warning': !project.title})}">
            <input type="text" placeholder="required" .value=${<string> project.title}
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
                 style=${styleMap({backgroundImage: `url('${project.image}')`})}></div>
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
                      .value=${<string> project.description || ''}
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
              <input type="text" placeholder="required" .value=${<string> view.title}
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
      <div class="ngm-label-btn" @click=${() => {
        if (this.projectEditing) {
          this.saveOrCancelWarning = true;
        } else {
          this.deselectTopicOrProject();
        }
      }}>
        <div class="ngm-back-icon"></div>
        ${i18next.t('dashboard_back_to_topics')}
      </div>
      <div class="project-edit-buttons">
        <button class="ui button ngm-action-btn ${classMap({'ngm-disabled': !project.title})}"
                @click=${async () => {
                  await apiClient.updateProject(project);
                  this.projectEditing = false;
                  this.saveOrCancelWarning = false;
                }}>
          ${i18next.t('save_project')}
        </button>
        <button class="ui button ngm-action-btn ngm-cancel-btn"
                @click=${() => {
                  this.refreshProjects();
                  this.projectEditing = false;
                  this.saveOrCancelWarning = false;
                }}>
          ${i18next.t('cancel')}
        </button>
      </div>
    `;
  }

  recentlyViewedTemplate() {
    if (this.selectedTopicOrProject || this.activeTab === 'projects' ||
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
    if (this.activeTab === 'overview' && !this.selectedTopicOrProject) {
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

  render() {
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
                ?hidden=${!apiClient.token}
               @click=${() => {
                  this.activeTab = 'projects';
                  this.deselectTopicOrProject();
                }}>
            ${i18next.t('dashboard_my_projects')} (${this.projects.length})
          </div>
        </div>
        <div class="ngm-close-icon" @click=${() => {
          if (this.projectEditing) {
            this.saveOrCancelWarning = true;
          } else {
            this.dispatchEvent(new CustomEvent('close'));
          }
        }}></div>
      </div>
      <div class="ngm-panel-content">
        <div class="ngm-toast-placeholder"></div>
        ${this.recentlyViewedTemplate()}
        <div ?hidden=${this.activeTab !== 'topics' || !!this.selectedTopicOrProject}>
          <div class="ngm-proj-title">${i18next.t('dashboard_recent_swisstopo')}</div>
          <div class="ngm-projects-list">
            ${this.topics?.map(data => this.previewTemplate(data))}
          </div>
        </div>
        <div>
          <div class="ngm-toast-placeholder" id="overview-toast" ?hidden=${!!apiClient.token}></div>
          ${this.overviewTemplate()}
        </div>
        <div ?hidden=${this.activeTab !== 'projects' || !!this.selectedTopicOrProject}>
          <div class="ngm-proj-title">${i18next.t('dashboard_my_projects')}</div>
          <div class="ngm-projects-list">
            ${this.projects.map(data => this.previewTemplate(data))}
          </div>
        </div>
        <div ?hidden=${!this.selectedTopicOrProject}>
          ${this.projectEditing ? this.projectEditingTemplate() : this.projectTabTemplate()}
        </div>
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
