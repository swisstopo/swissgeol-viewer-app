import { html, PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import $ from 'jquery';
import { LitElementI18n } from '../i18n.js';

import 'fomantic-ui-css/components/dimmer.js';
import 'fomantic-ui-css/components/modal.js';

@customElement('ngm-confirmation-modal')
export class NgmConfirmationModal extends LitElementI18n {
  @property({ type: Boolean })
  accessor show = false;
  @property({ type: Object })
  accessor text:
    | {
        title: string;
        description: string;
        cancelBtn: string;
        confirmBtn: string;
      }
    | undefined;
  element: JQuery<Element> | undefined;

  firstUpdated(_changedProperties: PropertyValues) {
    this.element = $(
      this.querySelector('.ngm-confirmation-modal.ui.modal')!,
    ).modal({
      centered: true,
      onHidden: () => (this.show = false),
      onApprove: () =>
        this.dispatchEvent(
          new CustomEvent('onModalConfirmation', { bubbles: true }),
        ),
    });
    super.firstUpdated(_changedProperties);
  }

  updated(changedProperties: PropertyValues) {
    if (this.element) {
      if (changedProperties.has('show') && this.show) {
        this.element.modal('show');
      } else if (!this.show) {
        this.element.modal('hide');
      }
    }
    super.updated(changedProperties);
  }

  render() {
    if (!this.text) {
      this.show = false;
      return '';
    }
    return html`
      <div class="ngm-confirmation-modal ui small modal">
        <div class="content">
          <h3>${this.text.title}</h3>
          <p>${this.text.description}</p>
        </div>
        <div class="actions">
          <div class="ui cancel button ngm-cancel-btn">
            ${this.text.cancelBtn}
          </div>
          <div class="ui ok button ngm-action-btn">${this.text.confirmBtn}</div>
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
