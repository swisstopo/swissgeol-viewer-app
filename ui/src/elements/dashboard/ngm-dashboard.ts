import { translated } from 'src/i18n';
import { customElement, property, query, state } from 'lit/decorators.js';
import { html, PropertyValues } from 'lit';
import i18next from 'i18next';
import { styleMap } from 'lit/directives/style-map.js';
import { classMap } from 'lit-html/directives/class-map.js';
import ToolboxStore from '../../store/toolbox';
import {
  getCameraView,
  getPermalink,
  removeProject,
  setPermalink,
  syncStoredView,
  syncTargetParam,
} from 'src/permalink';
import NavToolsStore from '../../store/navTools';
import DashboardStore from '../../store/dashboard';
import LocalStorageController from '../../LocalStorageController';
import type { Viewer } from 'cesium';
import { showSnackbarError } from 'src/notifications';
import { DEFAULT_PROJECT_COLOR } from 'src/constants';
import type { NgmGeometry } from 'src/toolbox/interfaces';
import { ApiClient } from 'src/api/api-client';
import '../hide-overflow';
import './ngm-project-edit';
import './ngm-project-topic-overview';
import { isProject, isProjectOwnerOrEditor } from './helpers';
import { consume } from '@lit/context';
import { LayerService } from 'src/features/layer/layer.service';
import { SessionService, User } from 'src/features/session';
import { Id, makeId } from 'src/models/id.model';
import { KmlLayer, LayerSourceType, LayerType } from 'src/features/layer';
import { CesiumService } from 'src/services/cesium.service';
import { CoreElement } from 'src/features/core';

const hostname = document.location.hostname;
export const PROJECT_ASSET_URL =
  hostname === 'localhost'
    ? 'http://localhost:9000/ngmpub-project-files-local/assets/saved/'
    : `https://project-files.${hostname}/assets/saved/`;

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
export class NgmDashboard extends CoreElement {
  @property({ type: Boolean })
  accessor hidden = true;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

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

  @state()
  private accessor user: User | null = null;

  private viewer: Viewer | null = null;
  private layerIds: Array<Id<KmlLayer>> = [];
  private geometries: NgmGeometry[] = [];
  private recentlyViewedIds: Array<string> = [];

  @consume({ context: ApiClient.context() })
  accessor apiClient!: ApiClient;

  @consume({ context: SessionService.context() })
  accessor sessionService!: SessionService;

  @consume({ context: CesiumService.context() })
  accessor cesiumService!: CesiumService;

  constructor() {
    super();

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
        if (
          topicOrProject.owner.email.toLowerCase() ===
          this.user?.email.toLowerCase()
        ) {
          this.activeTab = 'projects';
        } else {
          this.activeTab = 'shared';
        }
      }
    });
    DashboardStore.viewIndex.subscribe(async (viewIndex) => {
      await this.selectView(viewIndex);
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

  connectedCallback(): void {
    super.connectedCallback();

    this.register(
      this.sessionService.user$.subscribe((user) => {
        this.user = user;
      }),
    );

    this.register(
      this.cesiumService.viewer$.subscribe((viewer) => {
        this.viewer = viewer;
      }),
    );
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

  async fetchAssets(assets: Asset[]): Promise<Array<Id<KmlLayer>>> {
    if (this.viewer == null) {
      return [];
    }
    const layerIds: Array<Id<KmlLayer>> = [];
    for (const asset of assets) {
      const href = `${PROJECT_ASSET_URL}${asset.key}`;
      const id = makeId<KmlLayer>(crypto.randomUUID());
      this.layerService.activateCustomLayer({
        id,
        type: LayerType.Kml,
        source: {
          type: LayerSourceType.Url,
          url: href,
        },
        shouldClampToGround: !!asset.clampToGround,
        label: null,
        opacity: 1,
        canUpdateOpacity: false,
        isVisible: true,
        geocatId: null,
        downloadUrl: null,
        infoBox: null,
        customProperties: {},
        isLocal: true,
      } satisfies KmlLayer);
      layerIds.push(id);
    }
    return layerIds;
  }

  async selectView(viewIndex: number | undefined) {
    for (const layerId of this.layerIds) {
      this.layerService.deactivate(layerId);
    }
    this.layerIds = [];

    this.selectedViewIndx = viewIndex;
    syncTargetParam(undefined);
    NavToolsStore.nextTargetPointSync();
    if (this.viewer && this.selectedTopicOrProject && viewIndex !== undefined) {
      if (this.selectedTopicOrProject?.assets)
        this.layerIds = await this.fetchAssets(
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
      for (const layerId of this.layerIds) {
        this.layerService.deactivate(layerId);
      }
      this.layerIds = [];
      this.removeGeometries();
    });
  }

  async setDataFromPermalink() {
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
    if (this.user === null) {
      return;
    }
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
        email: this.user.email,
        name: this.user.email.split('@')[0],
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
    this.saveOrCancelWarning = false;
    if (this.selectedViewIndx !== undefined) {
      DashboardStore.setViewIndex(this.selectedViewIndx);
      if (this.selectedTopicOrProject?.assets) {
        this.layerIds = await this.fetchAssets(
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
      mode = isProjectOwnerOrEditor(this.user, this.selectedTopicOrProject)
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
          >${
            projOrTopic.description ? translated(projOrTopic.description) : ''
          }</span
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

  createRenderRoot() {
    return this;
  }

  render() {
    // const topics = html` <!-- topics hidden for now, see https://camptocamp.atlassian.net/browse/GSNGM-1171 -->
    //   <div
    //     class=${classMap({ active: this.activeTab === 'topics' })}
    //     @click=${() => {
    //       this.runIfNotEditCreate(() => {
    //         this.activeTab = 'topics';
    //         this.deselectTopicOrProject();
    //       });
    //     }}
    //   >
    //     ${i18next.t('dashboard_topics')}
    //   </div>`;
    const projectToEdit =
      this.projectTabState === 'create'
        ? this.projectToCreate
        : this.selectedTopicOrProject;

    return html`
      <div class="ngm-panel-header">
        <div class="ngm-dashboard-tabs">
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
            (${
              this.projects.filter(
                (p) =>
                  p.owner.email.toLowerCase() ===
                  this.user?.email.toLowerCase(),
              ).length
            })
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
            (${
              this.projects.filter(
                (p) =>
                  p.owner.email.toLowerCase() !==
                  this.user?.email.toLowerCase(),
              ).length
            })
          </div>
        </div>
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
              .filter(
                (p) =>
                  p.owner.email.toLowerCase() ===
                  this.user?.email.toLowerCase(),
              )
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
              .filter(
                (p) =>
                  p.owner.email.toLowerCase() !==
                  this.user?.email.toLowerCase(),
              )
              .map((data) => this.previewTemplate(data))}
          </div>
        </div>
        <div ?hidden=${!this.isProjectSelected}>
          ${
            this.projectTabState !== 'view'
              ? html`<ngm-project-edit
                  .project="${projectToEdit}"
                  .saveOrCancelWarning="${this.saveOrCancelWarning}"
                  .createMode="${this.projectTabState === 'create'}"
                  .userEmail="${this.user?.email}"
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
                  .userEmail="${this.user?.email}"
                  @onDeselect="${this.deselectTopicOrProject}"
                  @onEdit="${this.onProjectEdit}"
                  @onProjectDuplicated="${(evt: {
                    detail: { project: Project };
                  }) => this.onProjectDuplicated(evt.detail.project)}"
                  @onModalConfirmation="${() => this.deselectTopicOrProject()}"
                ></ngm-project-topic-overview>`
          }
        </div>
      </div>
    `;
  }
}
