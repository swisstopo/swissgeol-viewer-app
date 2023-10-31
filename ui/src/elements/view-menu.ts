import i18next from 'i18next';
import {html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {apiClient} from '../api-client';
import {LitElementI18n} from '../i18n';
import AuthStore from '../store/auth';
import DashboardStore from '../store/dashboard';
import $ from '../jquery';

import type {Project, Topic, View} from './ngm-dashboard';

@customElement('view-menu')
export class ViewMenu extends LitElementI18n {
    @state()
    accessor userEmail: string | undefined;
    @state()
    accessor viewIndex: number | undefined;
    @state()
    accessor selectedProject: Topic | Project | undefined;

    constructor() {
        super();
        AuthStore.user.subscribe(user => {
            // FIXME: extract from claims
            this.userEmail = user?.username.split('_')[1];
          });
        DashboardStore.selectedTopicOrProject.subscribe(topic => {
            this.selectedProject = topic;
        });
        DashboardStore.viewIndex.subscribe(viewIndex => {
            this.viewIndex = viewIndex;
        });
    }

    updated(changedProperties) {
        this.querySelectorAll('.ui.dropdown').forEach(elem => $(elem).dropdown({
            direction: 'upward'
          }));
        super.updated(changedProperties);
    }

    async saveViewToProject() {
        const project = <Project> this.selectedProject;
        if (this.viewIndex && this.userEmail && project.owner) {
            if ([project.owner, ...project.members].includes(this.userEmail)) {
                const view: View = {
                    id: crypto.randomUUID(),
                    title: `${i18next.t('view')} ${this.viewIndex + 2}`,
                    permalink: window.location.href,
                };
                project.views.splice(this.viewIndex + 1, 0, view);
                await apiClient.updateProject(project);
                DashboardStore.setViewIndex(this.viewIndex + 1);
            }
        } else {
            this.dispatchEvent(new CustomEvent('toggleProjectSelector'));
        }
    }


    render() {
        return html`
            <div class="ui dropdown">
                <div class="ngm-screenshot-icon"></div>
                <div class="menu">
                    <div class="item"
                         ?hidden=${!this.userEmail}
                         @click=${() => this.saveViewToProject()}>
                        <label>${i18next.t('save_to_project')}</label>
                        <div>
                            <div class="ngm-save-icon icon"></div>
                        </div>
                    </div>
                    <div class="item"
                         @click=${() => (<any> document.getElementsByClassName('ngm-share')[0]).click()}>
                        <label>${i18next.t('share_view')}</label>
                        <div>
                            <div class="ngm-share-icon icon"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }


    createRenderRoot() {
        return this;
    }
}