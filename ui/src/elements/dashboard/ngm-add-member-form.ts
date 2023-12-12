import {customElement, state} from 'lit/decorators.js';
import {LitElementI18n} from '../../i18n';
import {html, PropertyValues} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import i18next from 'i18next';
import {isEmail} from '../../utils';

export type MemberToAdd = {
    name: string;
    surname: string;
    email: string;
    role: 'viewer' | 'editor'
}

@customElement('ngm-add-member-form')
export class NgmAddMemberForm extends LitElementI18n {
    @state()
    accessor memberRole: 'viewer' | 'editor' | undefined;
    @state()
    accessor name: string | undefined;
    @state()
    accessor surname: string | undefined;
    @state()
    accessor email: string | undefined;
    @state()
    accessor roleDropdownShown = false;
    @state()
    accessor roleNotSelected = false;

    get roleDropdownText() {
        if (this.memberRole === 'editor') {
            return i18next.t('dashboard_project_editor');
        } else if (this.memberRole === 'viewer') {
            return i18next.t('dashboard_project_viewer');
        } else {
            return i18next.t('dashboard_project_choose_role');
        }
    }

    onAdd() {
        if (!this.name || !this.surname || !isEmail(this.email) || !this.memberRole) {
            this.name = this.name || '';
            this.surname = this.surname || '';
            this.email = this.email || '';
            this.roleNotSelected = !this.memberRole;
            return;
        }
        this.dispatchEvent(new CustomEvent('onMemberAdd', {
            detail: {
                name: this.name,
                surname: this.surname,
                email: this.email,
                role: this.memberRole
            }
        }));
    }

    updated(changedProperties: PropertyValues) {
        if (changedProperties.has('memberRole') && this.memberRole) {
            this.roleNotSelected = false;
        }
        super.updated(changedProperties);
    }

    render() {
        return html`
            <div class="ngm-member-add-form">
                <div class="ngm-input ${classMap({'ngm-input-warning': !this.name && this.name !== undefined})}">
                    <input type="text" placeholder="required" .value=${this.name || ''}
                           @input=${evt => {
                               this.name = evt.target.value;
                           }}/>
                    <span class="ngm-floating-label">${i18next.t('project_member_name')}</span>
                </div>
                <div class="ngm-input ${classMap({'ngm-input-warning': !this.surname && this.surname !== undefined})}">
                    <input type="text" placeholder="required" .value=${this.surname || ''}
                           @input=${evt => {
                               this.surname = evt.target.value;
                           }}/>
                    <span class="ngm-floating-label">${i18next.t('project_member_surname')}</span>
                </div>
                <div class="ngm-input ${classMap({'ngm-input-warning': !isEmail(this.email) && this.email !== undefined})}">
                    <input type="email" placeholder="required" .value=${this.email || ''}
                           @input=${evt => {
                               this.email = evt.target.value;
                           }}/>
                    <span class="ngm-floating-label">${i18next.t('project_member_email')}</span>
                </div>
                <div class="ui selection dropdown ngm-input ${classMap({
                    active: this.roleDropdownShown,
                    'ngm-input-warning': this.roleNotSelected
                })}"
                     @click=${() => this.roleDropdownShown = !this.roleDropdownShown}>
                    <input type="hidden" name="member-role">
                    <i class="dropdown icon"></i>
                    <div class="text ${classMap({default: !this.memberRole})}">${this.roleDropdownText}</div>
                    <div class="menu ${classMap({visible: this.roleDropdownShown})}">
                        <div class="item" @click=${() => this.memberRole = 'viewer'}>
                            ${i18next.t('dashboard_project_viewer')}
                        </div>
                        <div class="item" @click=${() => this.memberRole = 'editor'}>
                            ${i18next.t('dashboard_project_editor')}
                        </div>
                    </div>
                </div>
                <button class="ui button ngm-action-btn"
                        @click=${this.onAdd}
                >${i18next.t('dashboard_project_add_member')}
                </button>
            </div>`;
    }

    createRenderRoot() {
        return this;
    }

}