import { customElement, property, state } from 'lit/decorators.js';
import { LitElementI18n } from '../../i18n';
import { html } from 'lit';
import i18next from 'i18next';
import { Member, Project } from './ngm-dashboard';
import './ngm-add-member-form';
import { MemberRole, MemberToAdd } from './ngm-add-member-form';

@customElement('ngm-project-members-section')
export class NgmProjectMembersSection extends LitElementI18n {
  @property({ type: Object })
  accessor project!: Project;
  @property({ type: Boolean })
  accessor edit = false;
  @state()
  accessor showAddForm = false;

  onMemberAdd(evt: { detail: MemberToAdd }) {
    this.showAddForm = false;
    this.dispatchEvent(new CustomEvent('onMemberAdd', evt));
  }

  onMemberDelete(member: MemberToAdd) {
    this.dispatchEvent(new CustomEvent('onMemberDelete', { detail: member }));
  }

  memberInfoRender(member: Member, role: MemberRole) {
    let roleText = i18next.t('dashboard_project_owner');
    if (role === 'editor') roleText = i18next.t('dashboard_project_editor');
    else if (role === 'viewer')
      roleText = i18next.t('dashboard_project_viewer');
    return html`
      <div class="ngm-member-container">
        <div class="ngm-member">
          <div class="ngm-member-icon">
            ${member.name.charAt(0).toUpperCase()}${member.surname
              .charAt(0)
              .toUpperCase()}
          </div>
          <div class="ngm-member-info">
            <div>${member.name} ${member.surname} (${roleText})</div>
            <div class="ngm-member-email">${member.email}</div>
          </div>
        </div>
        ${!this.edit || role === 'owner'
          ? ''
          : html` <div
              class="ngm-icon ngm-delete-icon"
              @click=${() => this.onMemberDelete({ ...member, role })}
            ></div>`}
      </div>
    `;
  }

  render() {
    return html` <div>
      <div class="ngm-proj-title-icon">
        <div class="ngm-user-icon"></div>
        <div>${i18next.t('dashboard_project_members')}</div>
      </div>
      <div class="project-edit-fields">
        <div class="ngm-members-list">
          ${this.memberInfoRender(this.project.owner, 'owner')}
          ${this.project.editors.map((editor) =>
            this.memberInfoRender(editor, 'editor'),
          )}
          ${this.project.viewers.map((viewer) =>
            this.memberInfoRender(viewer, 'viewer'),
          )}
        </div>
        ${!this.edit || this.showAddForm
          ? ''
          : html` <div
              class="ngm-label-btn"
              @click=${() => (this.showAddForm = true)}
            >
              ${i18next.t('dashboard_project_add_member')}
              <div class="ngm-zoom-p-icon"></div>
            </div>`}
        ${!this.edit || !this.showAddForm
          ? ''
          : html`
              <ngm-add-member-form
                @onMemberAdd=${(evt) => this.onMemberAdd(evt)}
                @onCancel=${() => (this.showAddForm = false)}
              ></ngm-add-member-form>
            `}
      </div>
    </div>`;
  }

  createRenderRoot() {
    return this;
  }
}
