import i18next from 'i18next';
import {html} from 'lit';
import {customElement, property, query, state} from 'lit/decorators.js';
import {ApiClient} from '../api-client';
import {LitElementI18n} from '../i18n';
import DashboardStore from '../store/dashboard';
import $ from '../jquery';

import type {Project, Topic, View} from './ngm-dashboard';

@customElement('project-selector')
export class ProjectSelector extends LitElementI18n {
    @property({type: Boolean}) showProjectSelector = false;
    @state() projects: Project[] | undefined;
    @query('.item.active.selected') selection: any;
    private apiClient: ApiClient = new ApiClient();
    private selecedProject: Topic | Project | undefined;


    constructor() {
        super();
        DashboardStore.selectedTopicOrProject.subscribe(topic => {
            this.selecedProject = topic;
        });
        this.apiClient.getProjects()
            .then(response => response.json())
            .then(body => this.projects = body);
    }

    onFirstUpdate() {
        this.apiClient.getProjects()
            .then(response => response.json())
            .then(body => this.projects = body);
    }

    updated(changedProperties) {
        console.log('project', JSON.stringify(this.selecedProject));
        this.querySelectorAll('.ui.dropdown').forEach(elem => {
            this.selecedProject ?
            $(elem).dropdown('set selected', this.selecedProject.id) :
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

        await this.apiClient.updateProject(project!);

        this.dispatchEvent(new CustomEvent('close'));
    }

    render() {
        if (!this.showProjectSelector) {
            return html``;
        }

        return html`
            <div class="ngm-floating-window-header drag-handle">
                ${i18next.t('save_view_in_project')}
                <div class="ngm-close-icon" @click=${
                    () => this.dispatchEvent(new CustomEvent('close'))
                }></div>
            </div>
            <div class="ngm-cam-container">
                <div class="ui selection dropdown">
                    <input type="hidden" name="project">
                    <i class="dropdown icon"></i>
                    <div class="default text">${i18next.t('select_project')}</div>
                    <div class="menu">
                        ${this.projects?.map(project => html`
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