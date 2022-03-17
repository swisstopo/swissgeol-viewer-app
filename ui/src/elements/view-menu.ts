import i18next from 'i18next';
import {html} from 'lit';
import {customElement} from 'lit/decorators.js';
import {ApiClient} from '../api-client';
import {LitElementI18n} from '../i18n';
import AuthStore from '../store/auth';
import DashboardStore from '../store/dashboard';
import $ from '../jquery';

import type {Project, Topic, View} from './ngm-dashboard';

@customElement('view-menu')
export class ViewMenu extends LitElementI18n {
    private userEmail: string | undefined;
    private viewIndex: number | undefined;
    private selecedProject: Topic | Project | undefined;
    private apiClient = new ApiClient();

    constructor() {
        super();
        AuthStore.user.subscribe(user => {
            // FIXME: extract from claims
            this.userEmail = user?.username.split('_')[1];
          });
        DashboardStore.selectedTopicOrProject.subscribe(topic => {
            this.selecedProject = topic;
        });
        DashboardStore.viewIndex.subscribe(async viewIndex => {
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
        if (this.viewIndex && this.userEmail) {
            const project = <Project> this.selecedProject;
            if (project.owner === this.userEmail) {
                const view: View = {
                    id: crypto.randomUUID(),
                    title: `${i18next.t('view')} ${this.viewIndex + 1}`,
                    permalink: window.location.href,
                };
                project.views.splice(this.viewIndex, 0, view);
                await this.apiClient.updateProject(project);
            }
        } else {
            console.log('toggeProjectSelector');
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