import {LitElementI18n} from '../i18n';
import i18next from 'i18next';
import {html} from 'lit-element';
import 'fomantic-ui-css/components/accordion.js';
import $ from '../jquery.js';
import LocalStorageController from '../LocalStorageController';

class NgmReviewWindow extends LitElementI18n {

  firstUpdated() {
    $(this.querySelector('.accordion')).accordion({
      duration: 150,
      onChange: () => LocalStorageController.updateReviewWindowState()
    });
  }

  render() {
    return html`
      <div class="ui inverted segment">
        <div class="ui inverted accordion">
          <div class="title ${!LocalStorageController.hideReviewWindowValue ? 'active' : ''}">
            <i class="dropdown icon"></i>
            ${i18next.t('header_review_link')}
          </div>
          <div class="content ${!LocalStorageController.hideReviewWindowValue ? 'active' : ''}">
            <p>${i18next.t('review_window_text')}</p>
            <a href="https://findmind.ch/c/XmNb9jKz2w" target="_blank">${i18next.t('header_review_link')}</a>
          </div>
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-review-window', NgmReviewWindow);
