import { LitElementI18n, translated } from '../../i18n';
import { customElement, property, query, state } from 'lit/decorators.js';
import { html, PropertyValues } from 'lit';
import i18next from 'i18next';
import { styleMap } from 'lit/directives/style-map.js';
import { classMap } from 'lit-html/directives/class-map.js';
import MainStore from '../../store/main';
import ToolboxStore from '../../store/toolbox';
import {
  getCameraView,
  getPermalink,
  removeProject,
  setPermalink,
  syncStoredView,
  syncTargetParam,
} from '../../permalink';
import NavToolsStore from '../../store/navTools';
import DashboardStore from '../../store/dashboard';
import LocalStorageController from '../../LocalStorageController';
import type { Viewer } from 'cesium';
import { CustomDataSource } from 'cesium';
import { showSnackbarError } from '../../notifications';
import {
  DEFAULT_LAYER_OPACITY,
  DEFAULT_PROJECT_COLOR,
  PROJECT_ASSET_URL,
} from '../../constants';
import type { NgmGeometry } from '../../toolbox/interfaces';
import { ApiClient } from '../../api/api-client';
import AuthStore from '../../store/auth';
import '../hide-overflow';
import './ngm-project-edit';
import './ngm-project-topic-overview';
import { isProject, isProjectOwnerOrEditor } from './helpers';
import { LayerConfig } from '../../layertree';
import EarthquakeVisualizer from '../../earthquakeVisualization/earthquakeVisualizer';
import { parseKml, renderWithDelay } from '../../cesiumutils';
import { consume } from '@lit/context';
import { apiClientContext } from '../../context';

type TextualAttribute = string | TranslatedText;

export interface TranslatedText {
  de: string;
  fr: string;
  it: string;
  en: string;
}

export interface View {
  id: string;
  title: TextualAttribute;
  permalink: string;
}

export interface Asset {
  name: string;
  key: string;
  clampToGround?: boolean;
}

export interface Member {
  email: string;
  name: string;
  surname: string;
}

export interface Topic {
  id: string;
  title: TextualAttribute;
  description: TextualAttribute;
  created: string;
  modified: string;
  image: string;
  color: string;
  views: View[];
  assets: Asset[];
  geometries?: NgmGeometry[];
}

export interface CreateProject {
  title: string;
  description?: string;
  image?: string;
  color: string;
  views: View[];
  assets: Asset[];
  geometries?: NgmGeometry[];
  owner: Member;
  editors: Member[];
  viewers: Member[];
}

export interface Project extends CreateProject {
  id: string;
  created: string;
  modified: string;
}

export type TabTypes = 'topics' | 'overview' | 'projects' | 'shared';

@customElement('ngm-dashboard')
export class NgmDashboard extends LitElementI18n {
  @property({ type: Boolean })
  accessor hidden = true;
  @state()
  accessor projects: Project[] = [];
  @state()
  accessor activeTab: TabTypes = 'overview';
  @state()
  accessor selectedTopicOrProject: Topic | Project | undefined;
  @state()
  accessor projectToCreate: CreateProject | undefined;
  @state()
  accessor topics: Topic[] | undefined;
  @state()
  accessor selectedViewIndx: number | undefined;
  @state()
  accessor projectTabState: 'edit' | 'create' | 'view' = 'view';
  @state()
  accessor saveOrCancelWarning = false;
  @state()
  accessor showCursorPreloader = false;
  @query('.ngm-toast-placeholder')
  accessor toastPlaceholder;
  @query('#overview-toast')
  accessor overviewToast;
  private viewer: Viewer | null = null;
  private assetConfigs: any = {};
  private assets: LayerConfig[] | undefined;
  private geometries: NgmGeometry[] = [];
  private recentlyViewedIds: Array<string> = [];
  private userEmail: string | undefined;
  private readonly tempKmlDataSource = new CustomDataSource(
    'tempKmlDataSource',
  );

  @consume({ context: apiClientContext })
  accessor apiClient!: ApiClient;

  constructor() {
    super();
    MainStore.viewer.subscribe((viewer) => {
      this.viewer = viewer;
      this.viewer?.dataSources.add(this.tempKmlDataSource);
    });
    // topics hidden for now, see https://camptocamp.atlassian.net/browse/GSNGM-1171
    // fetch('./src/sampleData/topics.json').then(topicsResponse =>
    //   topicsResponse.json().then(topics => {
    //     this.topics = topics.map(topic => {
    //       if (topic.geometries) {
    //         topic.geometries = this.getGeometries(topic.geometries);
    //       }
    //       return topic;
    //     }).sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    //      // todo move DashboardStore.topicOrProjectParam.subscribe here
    //   }));

    DashboardStore.topicOrProjectParam.subscribe(async (value) => {
      if (!value) return;
      // topics hidden for now, see https://camptocamp.atlassian.net/browse/GSNGM-1171
      // if (value.kind === 'topic') {
      //   removeTopic();
      //   const topic = this.topics?.find(p => p.id === value.param.topicId);
      //   this.selectTopicOrProject(topic);
      // } else
      if (value.kind === 'project') {
        removeProject();
        const project = await this.apiClient.getProject(value.param.projectId);
        this.selectTopicOrProject(project);
      } else return;
      if (value.param.viewId) {
        const viewIndex = this.selectedTopicOrProject?.views.findIndex(
          (v) => v.id === value.param.viewId,
        );
        if (viewIndex !== -1) DashboardStore.setViewIndex(viewIndex);
      }
      this.hidden = false;
    });
    const recentlyViewed = localStorage.getItem('dashboard_recently_viewed');
    if (recentlyViewed) {
      this.recentlyViewedIds = JSON.parse(recentlyViewed);
    }
    DashboardStore.selectedTopicOrProject.subscribe((topicOrProject) => {
      this.selectedTopicOrProject = topicOrProject;
      if (isProject(topicOrProject)) {
        if (topicOrProject.owner.email === this.userEmail) {
          this.activeTab = 'projects';
        } else {
          this.activeTab = 'shared';
        }
      }
    });
    DashboardStore.viewIndex.subscribe(async (viewIndex) => {
      await this.selectView(viewIndex);
    });
    MainStore.layersRemoved.subscribe(async () => {
      if (this.selectedViewIndx !== undefined && this.assets) {
        await Promise.all(
          this.assets.map(async (layer) => {
            const data = await layer.promise;
            if (data && !(data instanceof EarthquakeVisualizer))
              data.show = true;
            this.dispatchEvent(
              new CustomEvent('layerclick', {
                detail: { layer },
              }),
            );
          }),
        );
      }
    });
    AuthStore.user.subscribe(() => {
      this.userEmail = AuthStore.userEmail;
    });
    DashboardStore.geometriesUpdate.subscribe((geometries) => {
      if (this.selectedTopicOrProject) {
        this.selectTopicOrProject({
          ...this.selectedTopicOrProject,
          geometries,
        });
      } else if (this.projectToCreate) {
        this.projectToCreate = { ...this.projectToCreate, geometries };
      }
    });

    DashboardStore.onSaveOrCancelWarning.subscribe((show) => {
      if (this.projectTabState !== 'view') {
        this.saveOrCancelWarning = show;
      }
    });
  }

  firstUpdated() {
    this.apiClient.refreshProjects();
    this.apiClient.projectsChange.subscribe((projects) => {
      this.refreshProjects(projects);
    });
  }

  refreshProjects(projects: Project[]) {
    this.projects = projects;
    const project = this.projects.find(
      (p) => p.id === this.selectedTopicOrProject?.id,
    );
    if (project) {
      this.selectTopicOrProject(project);
    }
  }

  // topics hidden for now, see https://camptocamp.atlassian.net/browse/GSNGM-1171
  // getGeometries(features: Array<GeoJSON.Feature>) {
  //   return features.map(feature => {
  //     return Object.assign(fromGeoJSON(feature), {
  //       editable: false,
  //       copyable: false,
  //     });
  //   });
  // }

  async fetchAssets(assets: Asset[]): Promise<LayerConfig[]> {
    const assetsData: LayerConfig[] = [];
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
          uploadedLayer = new CustomDataSource(href);
          const name = await parseKml(
            this.viewer,
            href,
            uploadedLayer,
            !!asset.clampToGround,
          );
          this.assetConfigs[href] = {
            label: name,
            opacity: DEFAULT_LAYER_OPACITY,
            notSaveToPermalink: true,
            topicKml: true,
          };
          MainStore.addUploadedKmlName(name);
          await this.viewer.dataSources.add(uploadedLayer);
          await renderWithDelay(this.viewer);
        }
        const promise = Promise.resolve(uploadedLayer);
        assetsData.push({
          ...this.assetConfigs[href],
          displayed: false,
          load() {
            return promise;
          },
          promise,
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
        this.assets = await this.fetchAssets(
          this.selectedTopicOrProject.assets,
        );
      this.geometries.forEach((geometry) =>
        ToolboxStore.setGeometryToCreate({ geometry }),
      );
      if (!LocalStorageController.storedView)
        LocalStorageController.storeCurrentView();
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
    this.geometries.forEach((geometry) =>
      ToolboxStore.nextGeometryAction({ id: geometry.id!, action: 'remove' }),
    );
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
    MainStore.setUrlLayersSubject.next();
    MainStore.nextMapSync();
    const { destination, orientation } = getCameraView();
    if (destination && orientation)
      this.viewer!.camera.flyTo({
        destination: destination,
        orientation: orientation,
        duration: 3,
        complete: () => {
          ToolboxStore.nextSliceSync();
          NavToolsStore.nextTargetPointSync();
        },
      });
  }

  addRecentlyViewedTopicOrProject(data: Topic | Project) {
    this.recentlyViewedIds.unshift(data.id);

    // remove duplicates
    this.recentlyViewedIds = [...new Set(this.recentlyViewedIds)];

    localStorage.setItem(
      'dashboard_recently_viewed',
      JSON.stringify(this.recentlyViewedIds),
    );
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
      views: [
        {
          id: '1',
          title: `${i18next.t('dashboard_project_view')} 1`,
          permalink: getPermalink(),
        },
      ],
      owner: {
        email: this.userEmail,
        name: this.userEmail.split('@')[0],
        surname: '',
      },
      editors: [],
      viewers: [],
    };
    this.projectTabState = 'create';
  }

  onProjectEdit() {
    this.projectTabState = 'edit';
  }

  async onProjectSave(project: Project | CreateProject) {
    if (this.projectTabState === 'edit' && isProject(project)) {
      await this.apiClient.updateProject(project);
    } else if (this.projectTabState === 'create' && this.projectToCreate) {
      try {
        const response = await this.apiClient.createProject(project);
        const id = await response.json();
        const createdProject = await this.apiClient.getProject(id);
        this.selectTopicOrProject(createdProject);
      } catch (e) {
        console.error(e);
        showSnackbarError(i18next.t('dashboard_project_create_error'));
      }
      this.projectToCreate = undefined;
    }
    this.tempKmlDataSource.entities.removeAll();
    this.saveOrCancelWarning = false;
    if (this.selectedViewIndx !== undefined) {
      DashboardStore.setViewIndex(this.selectedViewIndx);
      if (this.selectedTopicOrProject?.assets) {
        this.assets = await this.fetchAssets(
          this.selectedTopicOrProject.assets,
        );
      }
    }
    this.projectTabState = 'view';
  }

  cancelEditCreate() {
    this.apiClient.refreshProjects();
    this.projectTabState = 'view';
    this.saveOrCancelWarning = false;
    this.projectToCreate = undefined;
    this.tempKmlDataSource.entities.removeAll();
  }

  runIfNotEditCreate(callback: () => void) {
    if (this.projectTabState !== 'view') {
      this.saveOrCancelWarning = true;
    } else {
      callback();
    }
  }

  async onProjectPreviewClick(projOrTopic: Topic | Project) {
    if (isProject(projOrTopic)) {
      this.showCursorPreloader = true;
      projOrTopic = await this.apiClient.getProject(projOrTopic.id);
      this.showCursorPreloader = false;
    }
    this.selectTopicOrProject(projOrTopic);
  }

  get isProjectSelected() {
    return this.selectedTopicOrProject || this.projectToCreate;
  }

  get projectMode() {
    let mode: 'viewEdit' | 'viewOnly' | undefined = undefined;
    if (this.selectedViewIndx !== undefined && this.selectedTopicOrProject) {
      mode = isProjectOwnerOrEditor(this.selectedTopicOrProject)
        ? 'viewEdit'
        : 'viewOnly';
    }
    return this.projectTabState !== 'view' ? 'edit' : mode;
  }

  previewTemplate(projOrTopic?: Topic | Project) {
    if (!projOrTopic) return '';
    const backgroundImage = projOrTopic.image?.length
      ? `url('${projOrTopic.image}')`
      : 'none';
    return html` <div
      class="ngm-proj-preview ${classMap({
        'cursor-preloader': this.showCursorPreloader,
      })}"
      @click=${() => this.onProjectPreviewClick(projOrTopic)}
    >
      <div
        class="ngm-proj-preview-img"
        style=${styleMap({ backgroundImage })}
      ></div>
      <div
        class="ngm-proj-preview-title"
        style=${styleMap({ backgroundColor: projOrTopic.color })}
      >
        <span>${translated(projOrTopic.title)}</span>
      </div>
      <div class="ngm-proj-preview-subtitle">
        <span
          >${projOrTopic.description
            ? translated(projOrTopic.description)
            : ''}</span
        >
      </div>
    </div>`;
  }

  recentlyViewedTemplate() {
    if (
      this.isProjectSelected ||
      this.activeTab === 'projects' ||
      this.activeTab === 'shared' ||
      (this.activeTab === 'overview' && !this.apiClient.token)
    )
      return '';

    const topicsOrProjects =
      this.activeTab === 'topics' ? this.topics : this.projects;

    const recentlyViewed = this.recentlyViewedIds
      .map((id) => (<any[]>topicsOrProjects)?.find((item) => item.id === id))
      .filter((item) => item !== undefined);

    return recentlyViewed.length > 0
      ? html` <div>
          <div class="ngm-proj-title">
            ${i18next.t('dashboard_recently_viewed')}
          </div>
          <hide-overflow class="ngm-projects-list">
            ${recentlyViewed.map((data) => this.previewTemplate(data))}
          </hide-overflow>
        </div>`
      : html``;
  }

  overviewTemplate() {
    if (this.activeTab === 'overview' && !this.isProjectSelected) {
      if (this.apiClient.token) {
        return html`
          <div class="ngm-proj-title">
            ${i18next.t('dashboard_my_projects')}
          </div>
          <hide-overflow class="ngm-projects-list">
            ${this.projects.map((data) => this.previewTemplate(data))}
          </hide-overflow>
        `;
      } else {
        return html`<div class="ngm-hint">
          ${i18next.t('dashboard_overview_not_logged_in')}
        </div>`;
      }
    }
    return html``;
  }

  updated(changed: PropertyValues) {
    if (changed.has('projectTabState')) {
      DashboardStore.setProjectMode(this.projectMode);
    }
    if (
      (changed.has('hidden') ||
        changed.has('activeTab') ||
        changed.has('selectedTopicOrProject')) &&
      this.activeTab !== 'topics' &&
      !this.selectedTopicOrProject &&
      !this.hidden
    ) {
      this.apiClient.refreshProjects();
    }
    super.updated(changed);
  }

  render() {
    return html`
      <div class="ngm-panel-header">
        <div class="ngm-dashboard-tabs">
          <!-- topics hidden for now, see https://camptocamp.atlassian.net/browse/GSNGM-1171
          <div class=${classMap({ active: this.activeTab === 'topics' })}
               @click=${() => {
            this.runIfNotEditCreate(() => {
              this.activeTab = 'topics';
              this.deselectTopicOrProject();
            });
          }}>
            ${i18next.t('dashboard_topics')}
          </div>
          -->
          <div
            class=${classMap({ active: this.activeTab === 'overview' })}
            @click=${() => {
              this.runIfNotEditCreate(() => {
                this.activeTab = 'overview';
                this.deselectTopicOrProject();
              });
            }}
          >
            ${i18next.t('dashboard_overview')}
          </div>
          <div
            class=${classMap({ active: this.activeTab === 'projects' })}
            ?hidden=${!this.apiClient.token}
            @click=${() => {
              this.runIfNotEditCreate(() => {
                this.activeTab = 'projects';
                this.deselectTopicOrProject();
              });
            }}
          >
            ${i18next.t('dashboard_my_projects')}
            (${this.projects.filter((p) => p.owner.email === this.userEmail)
              .length})
          </div>
          <div
            class=${classMap({ active: this.activeTab === 'shared' })}
            ?hidden=${!this.apiClient.token}
            @click=${() => {
              this.runIfNotEditCreate(() => {
                this.activeTab = 'shared';
                this.deselectTopicOrProject();
              });
            }}
          >
            ${i18next.t('dashboard_shared_projects')}
            (${this.projects.filter((p) => p.owner.email !== this.userEmail)
              .length})
          </div>
        </div>
        <div
          class="ngm-close-icon"
          @click=${() => {
            this.runIfNotEditCreate(() =>
              this.dispatchEvent(new CustomEvent('close')),
            );
          }}
        ></div>
      </div>
      <div class="ngm-panel-content">
        <div class="ngm-toast-placeholder"></div>
        ${this.recentlyViewedTemplate()}
        <div ?hidden=${this.activeTab !== 'topics' || this.isProjectSelected}>
          <div class="ngm-proj-title">
            ${i18next.t('dashboard_recent_swisstopo')}
          </div>
          <div class="ngm-projects-list">
            ${this.topics?.map((data) => this.previewTemplate(data))}
          </div>
        </div>
        <div>
          <div
            class="ngm-toast-placeholder"
            id="overview-toast"
            ?hidden=${!!this.apiClient.token}
          ></div>
          ${this.overviewTemplate()}
        </div>
        <div ?hidden=${this.activeTab !== 'projects' || this.isProjectSelected}>
          <div class="ngm-proj-title">
            ${i18next.t('dashboard_my_projects')}
          </div>
          <div class="ngm-projects-list">
            ${this.projects
              .filter((p) => p.owner.email === this.userEmail)
              .map((data) => this.previewTemplate(data))}
            <div
              class="ngm-proj-preview ngm-proj-create"
              @click=${() => this.onProjectCreate()}
            >
              <div class="ngm-zoom-p-icon"></div>
              <div>${i18next.t('dashboard_project_create_btn')}</div>
            </div>
          </div>
        </div>
        <div ?hidden=${this.activeTab !== 'shared' || this.isProjectSelected}>
          <div class="ngm-proj-title">
            ${i18next.t('dashboard_shared_projects')}
          </div>
          <div class="ngm-projects-list">
            ${this.projects
              .filter((p) => p.owner.email !== this.userEmail)
              .map((data) => this.previewTemplate(data))}
          </div>
        </div>
        <div ?hidden=${!this.isProjectSelected}>
          ${this.projectTabState !== 'view'
            ? html`<ngm-project-edit
                .project="${this.projectTabState === 'create'
                  ? this.projectToCreate
                  : this.selectedTopicOrProject}"
                .saveOrCancelWarning="${this.saveOrCancelWarning}"
                .createMode="${this.projectTabState === 'create'}"
                .userEmail="${this.userEmail}"
                .tempKmlDataSource="${this.tempKmlDataSource}"
                @onBack=${this.deselectTopicOrProject}
                @onSave="${async (evt: { detail: { project: Project } }) =>
                  this.onProjectSave(evt.detail.project)}"
                @onCancel="${this.cancelEditCreate}"
              ></ngm-project-edit>`
            : html`<ngm-project-topic-overview
                .topicOrProject="${this.selectedTopicOrProject}"
                .toastPlaceholder="${this.toastPlaceholder}"
                .activeTab="${this.activeTab}"
                .selectedViewIndx="${this.selectedViewIndx}"
                .userEmail="${this.userEmail}"
                @onDeselect="${this.deselectTopicOrProject}"
                @onEdit="${this.onProjectEdit}"
                @onProjectDuplicated="${(evt: {
                  detail: { project: Project };
                }) => this.onProjectDuplicated(evt.detail.project)}"
                @onModalConfirmation="${() => this.deselectTopicOrProject()}"
              ></ngm-project-topic-overview>`}
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
