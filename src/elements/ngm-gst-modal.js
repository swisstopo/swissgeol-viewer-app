import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';

import $ from '../jquery.js';
import 'fomantic-ui-css/components/dimmer.js';
import 'fomantic-ui-css/components/modal.js';

class NgmGstModal extends I18nMixin(LitElement) {

  static get properties() {
    return {
      imageUrl: {type: String}
    };
  }

  updated() {
    if (this.imageUrl) {
      const element = $('.ngm-gst-modal.ui.modal').modal({
        centered: false,
        onHidden: () => this.imageUrl = null,
        onApprove: () => window.open(this.imageUrl, '_blank')
      });
      element.modal('show');
    }
  }

  render() {
    return html`
      <div class="ngm-gst-modal ui large modal">
        <div class="content">
          ${this.imageUrl ? html`<embed src="${this.imageUrl}"></embed>` : html``}
        </div>
        <div class="actions">
          <div class="ui cancel small labeled icon button">
            <i class="remove icon"></i>
            ${i18next.t('Close')}
          </div>
          <div class="ui ok green small labeled icon button">
            <i class="download icon"></i>
            ${i18next.t('Download PDF')}
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

customElements.define('ngm-gst-modal', NgmGstModal);
