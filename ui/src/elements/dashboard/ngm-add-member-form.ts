import { customElement, state } from 'lit/decorators.js';
import { LitElementI18n } from '../../i18n';
import { html, PropertyValues } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import i18next from 'i18next';
import { isEmail } from '../../utils';
import { DropdownChangedEvent, DropdownItem } from '../ngm-dropdown';

export type EditableRole = 'editor' | 'viewer';

export type MemberRole = 'owner' | EditableRole;

export type MemberToAdd = {
  name: string;
  surname: string;
  email: string;
  role: EditableRole;
};

@customElement('ngm-add-member-form')
export class NgmAddMemberForm extends LitElementI18n {
  @state()
  accessor memberRole: EditableRole | undefined;
  @state()
  accessor name: string | undefined;
  @state()
  accessor surname: string | undefined;
  @state()
  accessor email: string | undefined;
  @state()
  accessor roleNotSelected = false;
  private readonly roleDropdownItems: DropdownItem[] = [
    { title: i18next.t('dashboard_project_viewer'), value: 'viewer' },
    { title: i18next.t('dashboard_project_editor'), value: 'editor' },
  ];

  onAdd() {
    if (
      !this.name ||
      !this.surname ||
      !isEmail(this.email) ||
      !this.memberRole
    ) {
      this.name = this.name ?? '';
      this.surname = this.surname ?? '';
      this.email = this.email ?? '';
      this.roleNotSelected = !this.memberRole;
      return;
    }
    this.dispatchEvent(
      new CustomEvent('onMemberAdd', {
        detail: {
          name: this.name,
          surname: this.surname,
          email: this.email,
          role: this.memberRole,
        },
      }),
    );
  }

  updated(changedProperties: PropertyValues) {
    if (changedProperties.has('memberRole') && this.memberRole) {
      this.roleNotSelected = false;
    }
    super.updated(changedProperties);
  }

  render() {
    return html` <div class="ngm-member-add-form">
      <div
        class="ngm-input ${classMap({
          'ngm-input-warning': !this.name && this.name !== undefined,
        })}"
      >
        <input
          type="text"
          placeholder="required"
          .value=${this.name ?? ''}
          @input=${(evt) => {
            this.name = evt.target.value;
          }}
        />
        <span class="ngm-floating-label"
          >${i18next.t('project_member_name')}</span
        >
      </div>
      <div
        class="ngm-input ${classMap({
          'ngm-input-warning': !this.surname && this.surname !== undefined,
        })}"
      >
        <input
          type="text"
          placeholder="required"
          .value=${this.surname ?? ''}
          @input=${(evt) => {
            this.surname = evt.target.value;
          }}
        />
        <span class="ngm-floating-label"
          >${i18next.t('project_member_surname')}</span
        >
      </div>
      <div
        class="ngm-input ${classMap({
          'ngm-input-warning': !isEmail(this.email) && this.email !== undefined,
        })}"
      >
        <input
          type="email"
          placeholder="required"
          .value=${this.email ?? ''}
          @input=${(evt) => {
            this.email = evt.target.value;
          }}
        />
        <span class="ngm-floating-label"
          >${i18next.t('project_member_email')}</span
        >
      </div>
      <ngm-dropdown
        .items=${this.roleDropdownItems}
        .selectedValue=${this.memberRole}
        .defaultText=${i18next.t('dashboard_project_choose_role')}
        @changed=${(evt: DropdownChangedEvent<EditableRole>) =>
          (this.memberRole = evt.detail.newValue)}
      >
      </ngm-dropdown>
      <div class="action-buttons">
        <button class="ui button ngm-action-btn" @click=${this.onAdd}>
          ${i18next.t('dashboard_project_add_member')}
        </button>
        <button
          class="ui button ngm-action-btn ngm-cancel-btn"
          @click=${() => this.dispatchEvent(new CustomEvent('onCancel'))}
        >
          ${i18next.t('cancel')}
        </button>
      </div>
    </div>`;
  }

  createRenderRoot() {
    return this;
  }
}
