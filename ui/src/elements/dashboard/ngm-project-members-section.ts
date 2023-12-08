import {customElement} from 'lit/decorators.js';
import {LitElementI18n} from '../../i18n';
import {html} from 'lit';
import i18next from 'i18next';

@customElement('ngm-project-members-section')
export class NgmProjectMembersSection extends LitElementI18n {

    render() {
        return html`<div>
            <div class="ngm-proj-title-icon">
                <div class="ngm-user-icon"></div>
                <div>${i18next.t('dashboard_project_members')}</div>
            </div>
            <div class="project-edit-fields"></div>
        </div>`;
    }

    createRenderRoot() {
        return this;
    }

}