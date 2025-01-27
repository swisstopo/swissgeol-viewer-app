import { customElement, property, query } from 'lit/decorators.js';
import { LitElementI18n, toLocaleDateString, translated } from '../../i18n';
import { html, PropertyValues } from 'lit';
import i18next from 'i18next';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import DashboardStore from '../../store/dashboard';
import {
  CreateProject,
  Project,
  TabTypes,
  Topic,
  type View,
} from './ngm-dashboard';
import { ApiClient } from '../../api/api-client';
import { showBannerSuccess } from '../../notifications';
import $ from 'jquery';
import { DEFAULT_PROJECT_COLOR } from '../../constants';
import './ngm-project-geoms-section';
import './ngm-project-assets-section';
import '../ngm-confirmation-modal';
import './ngm-project-members-section';
import { isProject } from './helpers';
import { NgmConfirmationModal } from '../ngm-confirmation-modal';
import { getPermalink } from '../../permalink';
import { consume } from '@lit/context';
import { apiClientContext } from '../../context';

@customElement('ngm-project-topic-overview')
export class NgmProjectTopicOverview extends LitElementI18n {
  @property({ type: Object })
  accessor topicOrProject: Project | Topic | undefined;
  @property({ type: Object })
  accessor toastPlaceholder: HTMLElement | undefined;
  @property({ type: String })
  accessor activeTab: TabTypes = 'topics';
  @property({ type: String })
  accessor userEmail: string = '';
  @property({ type: Number })
  accessor selectedViewIndx: number | undefined;
  @query('ngm-confirmation-modal')
  accessor deleteWarningModal!: NgmConfirmationModal;

  @consume({ context: apiClientContext })
  accessor apiClient!: ApiClient;

  shouldUpdate(_changedProperties: PropertyValues): boolean {
    return this.topicOrProject !== undefined;
  }

  firstUpdated(_changedProperties: PropertyValues) {
    this.querySelectorAll('.ui.dropdown').forEach((elem) => $(elem).dropdown());
    super.firstUpdated(_changedProperties);
  }

  render() {
    if (!this.topicOrProject) return '';
    const project = isProject(this.topicOrProject)
      ? this.topicOrProject
      : undefined;
    const ownerEmail = project?.owner?.email;
    const owner = ownerEmail ?? i18next.t('swisstopo');
    const date = this.topicOrProject?.modified
      ? this.topicOrProject?.modified
      : this.topicOrProject?.created;
    const backgroundImage = this.topicOrProject.image?.length
      ? `url('${this.topicOrProject.image}')`
      : 'none';
    const editorEmails = project?.editors?.map((m) => m.email) || [];
    const projectModerator = [ownerEmail, ...editorEmails].includes(
      this.userEmail,
    );

    return html`
      <ngm-confirmation-modal
        @onModalConfirmation="${() => this.deleteProject()}"
        .text="${{
          title: i18next.t('dashboard_delete_warning_title'),
          description: i18next.t('dashboard_delete_warning_description'),
          cancelBtn: i18next.t('cancel'),
          confirmBtn: i18next.t('delete'),
        }}"
      ></ngm-confirmation-modal>
      <div>
        <div class="ngm-proj-title">
          ${translated(this.topicOrProject.title)}
          <div class="project-menu">
            <div
              class="edit-project"
              ?hidden=${this.activeTab === 'topics' || !projectModerator}
              @click=${() => this.dispatchEvent(new CustomEvent('onEdit'))}
            >
              ${i18next.t('edit_project')}
              <div class="ngm-edit-icon"></div>
            </div>
            <div class="ui dropdown right pointing ngm-action-menu">
              <div class="ngm-view-icon ngm-action-menu-icon"></div>
              ${this.contextMenu()}
            </div>
          </div>
        </div>
        <div class="ngm-proj-data">
          ${`${this.topicOrProject.modified ? i18next.t('modified_on') : i18next.t('created_on')} ${toLocaleDateString(date)} ${i18next.t('by')} ${owner}`}
        </div>
        <div class="ngm-proj-information">
          <div>
            <div
              class="ngm-proj-preview-img"
              style=${styleMap({ backgroundImage })}
            ></div>
            <div
              class="ngm-proj-preview-title"
              style=${styleMap({ backgroundColor: this.topicOrProject.color })}
            ></div>
          </div>
          <div class="ngm-proj-description">
            <div class="ngm-proj-description-title">
              ${i18next.t('dashboard_description')}
            </div>
            <div class="ngm-proj-description-content">
              ${this.topicOrProject.description
                ? translated(this.topicOrProject.description)
                : ''}
            </div>
          </div>
        </div>
      </div>
      <div class="ngm-divider"></div>
      <div class="ngm-proj-views-header">
        <div class="ngm-proj-title-icon">
          <div class="ngm-screenshot-icon"></div>
          <div>${i18next.t('dashboard_views')}</div>
        </div>
        <button
          class="ngm-save-view-btn"
          .hidden="${!this.userEmail || !project?.owner}"
          @click=${() => this.saveViewToProject()}
        >
          <div>${i18next.t('dashboard_add_view')}</div>
          <div class="ngm-save-icon icon"></div>
        </button>
      </div>
      <div class="ngm-project-views">
        ${this.topicOrProject.views.map(
          (view, index) => html`
            <div
              class="ngm-action-list-item ${classMap({
                active: this.selectedViewIndx === index,
              })}"
            >
              <div class="ngm-action-list-item-header">
                <div
                  @click=${() =>
                    DashboardStore.setViewIndex(
                      this.selectedViewIndx === index ? undefined : index,
                    )}
                >
                  ${translated(view.title)}
                </div>
                <div
                  title="${i18next.t('dashboard_share_topic')}"
                  class="ngm-view-icon ngm-share-icon"
                  @click=${() => this.copyLink(view.id)}
                ></div>
              </div>
            </div>
          `,
        )}
      </div>
      <div class="ngm-divider"></div>
      <div class="ngm-proj-edit-assets">
        <ngm-project-geoms-section
          .viewMode=${true}
          .geometries="${this.topicOrProject.geometries}"
        ></ngm-project-geoms-section>
        <ngm-project-assets-section
          .assets="${this.topicOrProject.assets}"
          .toastPlaceholder="${this.toastPlaceholder}"
          .viewMode=${true}
        ></ngm-project-assets-section>
      </div>
      ${!project
        ? ''
        : html`
            <div class="ngm-divider"></div>
            <ngm-project-members-section
              .project=${project}
            ></ngm-project-members-section>
          `}
      <div class="ngm-divider"></div>
      <div
        class="ngm-label-btn"
        @click=${() => this.dispatchEvent(new CustomEvent('onDeselect'))}
      >
        <div class="ngm-back-icon"></div>
        ${i18next.t('dashboard_back_to_topics')}
      </div>
    `;
  }

  contextMenu() {
    return html`
      <div class="menu">
        <div class="item" @click=${() => this.copyLink()}>
          ${i18next.t('dashboard_share_topic')}
        </div>
        <div
          class="item ${this.apiClient.token ? '' : 'disabled'}"
          @click=${() => this.duplicateToProject()}
        >
          ${i18next.t('duplicate_to_project')}
        </div>
        <a
          class="item"
          target="_blank"
          href="mailto:?body=${encodeURIComponent(this.getLink() ?? '')}"
        >
          ${i18next.t('dashboard_share_topic_email')}
        </a>
        ${isProject(this.topicOrProject) &&
        this.topicOrProject.owner.email !== this.userEmail
          ? ''
          : html` <div
              class="item"
              ?hidden=${this.activeTab === 'topics'}
              @click=${() => (this.deleteWarningModal.show = true)}
            >
              ${i18next.t('delete')}
            </div>`}
      </div>
    `;
  }

  async duplicateToProject() {
    const createProject = this.toCreateProject(this.topicOrProject!);
    const response = await this.apiClient.duplicateProject(createProject);
    const id = await response.json();
    const project = await this.apiClient.getProject(id);
    this.dispatchEvent(
      new CustomEvent('onProjectDuplicated', { detail: { project } }),
    );
  }

  async deleteProject() {
    await this.apiClient.deleteProject(this.topicOrProject!.id);
  }

  async copyLink(viewId?: string) {
    try {
      const link = this.getLink(viewId);
      if (link) await navigator.clipboard.writeText(link);
      showBannerSuccess(this.toastPlaceholder!, i18next.t('shortlink_copied'));
    } catch (e) {
      console.error(e);
    }
  }

  getLink(viewId?: string): string | undefined {
    if (!this.topicOrProject) return;
    let link = `${location.protocol}//${location.host}${location.pathname}?`;
    const idKey = isProject(this.topicOrProject) ? 'projectId' : 'topicId';
    link = `${link}${idKey}=${this.topicOrProject.id}`;
    if (viewId) link = `${link}&viewId=${viewId}`;
    return link;
  }

  toCreateProject(topicOrProject: Topic | Project): CreateProject {
    const title = isProject(topicOrProject)
      ? `${i18next.t('tbx_copy_of_label')} ${topicOrProject.title}`
      : translated(topicOrProject.title);
    let description: string | undefined;
    if (isProject(topicOrProject)) {
      description = topicOrProject.description;
    } else if (topicOrProject.description) {
      description = translated(topicOrProject.description);
    }
    return {
      title,
      description,
      color: isProject(topicOrProject)
        ? topicOrProject.color
        : DEFAULT_PROJECT_COLOR,
      geometries: isProject(topicOrProject) ? topicOrProject.geometries : [], // not a copy for topic
      assets: isProject(topicOrProject) ? topicOrProject.assets : [], // not a copy for topic
      views: topicOrProject.views.map((view) => ({
        id: crypto.randomUUID(),
        title: translated(view.title),
        permalink: view.permalink,
      })),
      owner: {
        email: this.userEmail,
        name: this.userEmail.split('@')[0],
        surname: '',
      },
      editors: [],
      viewers: [],
    };
  }

  async saveViewToProject() {
    const project: Project | undefined = isProject(this.topicOrProject)
      ? this.topicOrProject
      : undefined;
    const editorEmails = project?.editors.map((e) => e.email) || [];
    if (
      !project ||
      ![project.owner.email, ...editorEmails].includes(this.userEmail)
    )
      return;
    const view: View = {
      id: crypto.randomUUID(),
      title: `${i18next.t('view')} ${project?.views.length + 1}`,
      permalink: getPermalink(),
    };
    if (typeof this.selectedViewIndx !== 'number') {
      project.views.push(view);
      const success = await this.apiClient.updateProject(project);
      if (success) {
        DashboardStore.setViewIndex(project?.views.length - 1);
      }
    } else {
      project.views.splice(this.selectedViewIndx + 1, 0, view);
      const success = await this.apiClient.updateProject(project);
      if (success) {
        DashboardStore.setViewIndex(this.selectedViewIndx + 1);
      }
    }
  }

  createRenderRoot() {
    return this;
  }
}
