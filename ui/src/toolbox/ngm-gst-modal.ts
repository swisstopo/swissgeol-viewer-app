import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import i18next from 'i18next';
import { LitElementI18n } from '../i18n.js';

import $ from 'jquery';
import 'fomantic-ui-css/components/dimmer.js';
import 'fomantic-ui-css/components/modal.js';

@customElement('ngm-gst-modal')
export class NgmGstModal extends LitElementI18n {
  @property({ type: String })
  accessor imageUrl: string | undefined;
  element;

  firstUpdated(_changedProperties) {
    this.element = $('.ngm-gst-modal.ui.modal').modal({
      centered: false,
      onHidden: () => (this.imageUrl = undefined),
      onApprove: () => window.open(this.imageUrl, '_blank'),
    });
    super.firstUpdated(_changedProperties);
  }

  updated(changedProperties) {
    if (changedProperties.has('imageUrl') && this.imageUrl) {
      this.element.modal('show');
    } else if (!this.imageUrl) {
      this.element.modal('hide');
    }
    super.updated(changedProperties);
  }

  get getOutputType() {
    if (!this.imageUrl) return '';
    const splitedUrl = this.imageUrl.split('.');
    const extension = splitedUrl[splitedUrl.length - 1];
    return extension.toUpperCase();
  }

  render() {
    return html`
      <div class="ngm-gst-modal ui large modal">
        <div class="content">
          ${this.imageUrl
            ? html`
            <embed src="${this.imageUrl}"></embed>`
            : html``}
        </div>
        <div class="actions">
          <div class="ui cancel button ngm-cancel-btn">
            ${i18next.t('tbx_gst_close_label')}
          </div>
          <div class="ui ok button ngm-action-btn">
            ${i18next.t('tbx_download_section_output_label')}
            ${this.getOutputType}
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
