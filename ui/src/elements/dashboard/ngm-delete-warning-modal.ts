import {html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import $ from '../../jquery.js';
import i18next from 'i18next';
import {LitElementI18n} from '../../i18n.js';

import 'fomantic-ui-css/components/dimmer.js';
import 'fomantic-ui-css/components/modal.js';

@customElement('ngm-delete-warning-modal')
export class NgmDeleteWarningModal extends LitElementI18n {
  @property({type: Boolean})
  accessor show = false;
  element;

  firstUpdated(_changedProperties) {
    this.element = $('.ngm-delete-warning-modal.ui.modal').modal({
      centered: true,
      onHidden: () => this.show = false,
      onApprove: () => this.dispatchEvent(new CustomEvent('onProjectDeleted', {bubbles: true}))
    });
    super.firstUpdated(_changedProperties);
  }

  updated(changedProperties) {
    if (changedProperties.has('show') && this.show) {
      this.element.modal('show');
    } else if (!this.show) {
      this.element.modal('hide');
    }
    super.updated(changedProperties);
  }

  render() {
    return html`
      <div class="ngm-delete-warning-modal ui small modal">
        <div class="content">
          <h3>${i18next.t('dashboard_delete_warning_title')}</h3>
          <p>${i18next.t('dashboard_delete_warning_description')}</p>
        </div>
        <div class="actions">
          <div class="ui cancel button ngm-cancel-btn">
            ${i18next.t('cancel')}
          </div>
          <div class="ui ok button ngm-action-btn">
            ${i18next.t('delete')}
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
