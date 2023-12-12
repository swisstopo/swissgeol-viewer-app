import {customElement, property} from 'lit/decorators.js';
import {LitElementI18n} from '../../i18n';
import {html} from 'lit';
import i18next from 'i18next';
import {Member, Project} from './ngm-dashboard';

@customElement('ngm-project-members-section')
export class NgmProjectMembersSection extends LitElementI18n {
    @property({type: Object})
    accessor project!: Project;

    memberInfoRender(member: Member, role: 'owner' | 'editor' | 'viewer') {
        let roleText = i18next.t('dashboard_project_owner');
        if (role === 'editor') roleText = i18next.t('dashboard_project_editor');
        else if (role === 'viewer') roleText = i18next.t('dashboard_project_member');
        return html`
            <div class="ngm-member">
                <div class="ngm-member-icon">
                    ${member.name.charAt(0).toUpperCase()}${member.surname.charAt(0).toUpperCase()}
                </div>
                <div class="ngm-member-info">
                    <div>${member.name} ${member.surname} (${roleText})</div>
                    <div class="ngm-member-email">${member.email}</div>
                </div>
            </div>
        `;
    }

    render() {
        return html`
            <div>
                <div class="ngm-proj-title-icon">
                    <div class="ngm-user-icon"></div>
                    <div>${i18next.t('dashboard_project_members')}</div>
                </div>
                <div class="project-edit-fields">
                    ${this.memberInfoRender(this.project.owner, 'owner')}
                </div>
            </div>`;
    }

    createRenderRoot() {
        return this;
    }

}