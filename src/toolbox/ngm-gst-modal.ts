import {customElement, html, property} from 'lit-element';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';

import $ from '../jquery.js';
import 'fomantic-ui-css/components/dimmer.js';
import 'fomantic-ui-css/components/modal.js';

@customElement('ngm-gst-modal')
export class NgmGstModal extends LitElementI18n {
  @property({type: String}) imageUrl = ''
  element;

  updated() {
    if (this.imageUrl) {
      if (!this.element) {
        this.element = $('.ngm-gst-modal.ui.modal').modal({
          centered: false,
          onHidden: () => this.imageUrl = '',
          onApprove: () => window.open(this.imageUrl, '_blank')
        });
      }
      this.element.modal('show');
    }
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
          ${this.imageUrl ? html`
            <embed src="${this.imageUrl}"></embed>` : html``}
        </div>
        <div class="actions">
          <div class="ui cancel small labeled icon button">
            <i class="remove icon"></i>
            ${i18next.t('tbx_gst_close_label')}
          </div>
          <div class="ui ok green small labeled icon button">
            <i class="download icon"></i>
            ${i18next.t('tbx_download_section_output_label')} ${this.getOutputType}
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
