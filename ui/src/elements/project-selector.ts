import i18next from 'i18next';
import {html} from 'lit';
import {customElement, property, query, state} from 'lit/decorators.js';
import {apiClient} from '../api-client';
import draggable from './draggable';
import {LitElementI18n} from '../i18n';
import DashboardStore from '../store/dashboard';
import AuthStore from '../store/auth';
import $ from '../jquery';

import type {Project, Topic, View} from './ngm-dashboard';

@customElement('project-selector')
export class ProjectSelector extends LitElementI18n {
    @property({type: Boolean}) showProjectSelector = false;
    @state() projects: Project[] | undefined;
    @state() userEmail: string | undefined;
    @query('.item.active.selected') selection: any;
    private selectedProject: Topic | Project | undefined;

    constructor() {
        super();
        DashboardStore.selectedTopicOrProject.subscribe(topic => {
            this.selectedProject = topic;
        });

        AuthStore.user.subscribe(user => {
            // FIXME: extract from claims
            this.userEmail = user?.username.split('_')[1];
        });

        apiClient.projectsChange.subscribe(() => this.refreshProjects());
        this.refreshProjects();
    }

    refreshProjects() {
        apiClient.getProjects()
            .then(response => response.json())
            .then(body => this.projects = body);
    }

    connectedCallback() {
        draggable(this, {
            allowFrom: '.drag-handle'
        });
        super.connectedCallback();
    }

    updated(changedProperties) {
        this.querySelectorAll('.ui.dropdown').forEach(elem => {
            this.selectedProject ?
            $(elem).dropdown('set selected', this.selectedProject.id) :
            $(elem).dropdown();
        });
        super.updated(changedProperties);
    }

    async saveViewToProject() {
        const id = this.selection.getAttribute('data-value');
        const project = this.projects!.find(project => project.id === id)!;

        const view: View = {
            id: crypto.randomUUID(),
            title: `${i18next.t('view')} ${project?.views.length + 1}`,
            permalink: window.location.href,
        };

        project.views.push(view);

        await apiClient.updateProject(project!);

        this.dispatchEvent(new CustomEvent('close'));

        DashboardStore.setSelectedTopicOrProject(project);
        DashboardStore.setViewIndex(project?.views.length - 1);
    }

    render() {
        if (!this.showProjectSelector) {
            return html``;
        }

        return html`
            <div class="ngm-floating-window-header drag-handle">
                ${i18next.t('save_view_in_project')}
                <div class="ngm-close-icon" @click=${() => this.dispatchEvent(new CustomEvent('close'))}></div>
            </div>
            <div>
                <div class="ui selection dropdown ngm-input">
                    <input type="hidden" name="project">
                    <i class="dropdown icon"></i>
                    <div class="default text">${i18next.t('select_project')}</div>
                    <div class="menu">
                        ${this.projects?.filter(p => [p.owner, ...p.members].includes(this.userEmail!)).map(project => html`
                            <div class="item" 
                                 data-value="${project.id}"
                            >${project.title}</div>
                            `)}
                    </div>
                </div>
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