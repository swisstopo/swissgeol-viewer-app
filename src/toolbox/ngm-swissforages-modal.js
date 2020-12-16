import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';

import $ from '../jquery.js';
import 'fomantic-ui-css/components/dimmer.js';
import 'fomantic-ui-css/components/modal.js';
import 'fomantic-ui-css/components/dropdown.js';
import {SWISSFORAGES_VIEWER_URL} from '../constants';
import {showWarning} from '../message';

class NgmSwissforagesModal extends I18nMixin(LitElement) {

  constructor() {
    super();
    this.userWorkgroups = [];
    this.username = '';
    this.password = '';
    this.depth = 0;
  }

  static get properties() {
    return {
      service: {type: Object},
      options: {type: Object},
      loading: {type: Boolean}
    };
  }

  updated() {
    if (this.options.show) {
      if (!this.element) {
        this.element = $('.ngm-swissforages-modal.ui.modal').modal({
          centered: false,
          onHidden: () => {
            this.options.show = false;
            this.options.onSwissforagesBoreholeCreated = undefined;
            this.options.onLoggedIn = undefined;
          },
          onHide: () => !this.loading
        });
      }
      this.element.modal('show');
    }
  }

  initWorkgroupSelector() {
    if (!this.userWorkgroups) return;
    this.service.workGroupId = this.userWorkgroups[0].id;
    $('.ui.dropdown.ngm-swissforages-workgroup-selector')
      .dropdown({
        values: this.userWorkgroups.map((group, indx) => {
          return {
            name: group.workgroup,
            value: group.id,
            selected: indx === 0
          };
        }),
        onChange: (value) => {
          this.service.workGroupId = Number(value);
        }
      });
    this.groupsSelectorInited = true;
    this.requestUpdate();
  }

  async login() {
    if (!this.username.length || !this.password.length) {
      showWarning(i18next.t('tbx_swissforages_incorrect_creds_warning'));
      return;
    }
    this.toggleLoading();
    try {
      this.userWorkgroups = await this.service.login(this.username, this.password);
      this.initWorkgroupSelector();
      this.toggleLoading();
      if (this.options.onLoggedIn) {
        this.options.show = false;
        this.element.modal('hide');
        this.options.onLoggedIn();
      }
    } catch (e) {
      showWarning(e);
      this.loading = false;
    }
  }

  toggleLoading() {
    this.loading = !this.loading;
  }

  async createBorehole() {
    this.toggleLoading();
    try {
      const boreholeId = await this.service.createBorehole(this.options.position, this.depth, this.options.name);
      this.options.onSwissforagesBoreholeCreated(this.options.id, boreholeId, this.depth);
      this.toggleLoading();
    } catch (e) {
      showWarning(e);
      this.loading = false;
    }
  }

  render() {
    return html`
      <div class="ngm-swissforages-modal ui modal ${this.options.swissforagesId ? 'large' : 'mini'}">
        <div class="ui inverted dimmer ${this.loading ? 'active' : ''}">
          <div class="ui loader"></div>
        </div>
        <div class="content" style="height: ${this.options.swissforagesId ? '80vh' : 'auto'}">
          <div ?hidden="${this.service.userToken || this.options.swissforagesId}">
            <label>${i18next.t('tbx_swissforages_login_label')}</label>
            <div class="ngm-swissforages-configuration">
              <div class="ui input">
                <input
                  class="ngm-swissforages-login-input"
                  type="text"
                  placeholder="${i18next.t('tbx_swissforages_username_label')}"
                  @input="${evt => this.username = evt.target.value}">
              </div>
              <div class="ui input">
                <input
                  class="ngm-swissforages-password-input"
                  type="password"
                  placeholder="${i18next.t('tbx_swissforages_password_label')}"
                  @input="${evt => this.password = evt.target.value}">
              </div>
            </div>
          </div>
          <div
            ?hidden="${!this.service.userToken || this.options.swissforagesId}"
            class="ngm-swissforages-configuration">
            <div>
              <label>${i18next.t('tbx_swissforages_workgroup_label')}</label>
              <div
                class="ui dropdown ngm-swissforages-workgroup-selector ${this.userWorkgroups.length === 1 ? 'disabled' : ''}">
                <div class="text"></div>
                <i class="dropdown icon"></i>
              </div>
            </div>
            <div>
              <label>${i18next.t('tbx_swissforages_depth_label')}</label>
              <div class="ui input tiny">
                <input
                  class="ngm-swissforages-depth-input"
                  type="number"
                  @input="${evt => this.depth = Number(evt.target.value)}">
              </div>
            </div>
          </div>
          <iframe
            ?hidden="${!this.options.swissforagesId}"
            src="${`${SWISSFORAGES_VIEWER_URL}${this.options.swissforagesId}`}" width="100%" height="100%"
            style="border:none;">
          </iframe>
        </div>
        <div class="actions">
          <div class="ui cancel small button">
            ${i18next.t('tbx_gst_close_label')}
          </div>
          <div
            class="ui green small button"
            ?hidden="${this.options.swissforagesId || this.service.userToken}"
            @click="${() => this.login()}">
            ${i18next.t('tbx_swissforages_modal_login_btn_label')}
          </div>
          <div
            class="ui green small button"
            ?hidden="${this.options.swissforagesId || !this.service.userToken}"
            @click="${() => this.createBorehole()}">
            ${i18next.t('tbx_swissforages_modal_create_btn_label')}
          </div>
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-swissforages-modal', NgmSwissforagesModal);
