import i18next from 'i18next';
import {html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {apiClient} from '../api-client';
import draggable from './draggable';
import {LitElementI18n} from '../i18n';
import DashboardStore from '../store/dashboard';
import AuthStore from '../store/auth';

import type {Project, View} from './dashboard/ngm-dashboard';
import {getPermalink} from '../permalink';
import {isProject} from './dashboard/helpers';
import './ngm-dropdown';
import {DropdownChangedEvent} from './ngm-dropdown';

@customElement('project-selector')
export class ProjectSelector extends LitElementI18n {
    @property({type: Boolean})
    accessor showProjectSelector = false;
    @state()
    accessor projects: Project[] | undefined;
    @state()
    accessor userEmail: string | undefined;
    @state()
    accessor selectedProjectId: string | undefined;

    constructor() {
        super();
        DashboardStore.selectedTopicOrProject.subscribe(project => {
            if (isProject(project)) {
                this.selectedProjectId = project.id;
            }
        });

        AuthStore.user.subscribe(user => {
            // FIXME: extract from claims
            this.userEmail = user?.username.split('_')[1];
        });

        apiClient.projectsChange.subscribe((projects) => {
            this.projects = projects;
        });
        apiClient.refreshProjects();
    }

    connectedCallback() {
        draggable(this, {
            allowFrom: '.drag-handle'
        });
        super.connectedCallback();
    }

    async saveViewToProject() {
        if (!this.selectedProjectId) return;
        const project = this.projects!.find(project => project.id === this.selectedProjectId)!;
        if (!project) return;
        DashboardStore.setSelectedTopicOrProject(project);

        const view: View = {
            id: crypto.randomUUID(),
            title: `${i18next.t('view')} ${project?.views.length + 1}`,
            permalink: getPermalink(),
        };

        project.views.push(view);

        const success = await apiClient.updateProject(project!);
        if (success) {
            this.dispatchEvent(new CustomEvent('close'));
            DashboardStore.setViewIndex(project?.views.length - 1);
        }
    }

    render() {
        if (!this.showProjectSelector) {
            return html``;
        }
        const dropdownItems = this.projects?.filter(p => [p.owner.email, ...p.editors]
            .includes(this.userEmail!))
            .map(project => {
                return {
                    title: project.title,
                    value: project.id
                };
            });
        return html`
            <div class="ngm-floating-window-header drag-handle">
                ${i18next.t('save_view_in_project')}
                <div class="ngm-close-icon" @click=${() => this.dispatchEvent(new CustomEvent('close'))}></div>
            </div>
            <div>
                <ngm-dropdown .items=${dropdownItems}
                              .selectedValue=${this.selectedProjectId}
                              .defaultText=${i18next.t('select_project')}
                              @changed=${(evt: DropdownChangedEvent) => this.selectedProjectId = evt.detail.newValue}>
                </ngm-dropdown>
                <button class="ui button ngm-action-btn"
                        @click=${async () => await this.saveViewToProject()}
                >${i18next.t('save')}</button>
            </div>
        `;
    }

    createRenderRoot() {
        return this;
    }
}