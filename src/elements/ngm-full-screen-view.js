import {I18nMixin} from '../i18n';
import i18next from 'i18next';
import {LitElement, html} from 'lit-element';

const ELEMENTS_TO_HIDE = ['.ngm-header-content', 'ngm-left-side-bar', '.navigation-widgets', 'ngm-review-window'];

class NgmFullScreenView extends I18nMixin(LitElement) {

  static get properties() {
    return {
      fullScreenActive: {type: Boolean}
    };
  }

  constructor() {
    super();

    this.fullScreenActive = false;
  }

  get tooltip() {
    if (this.fullScreenActive) {
      return i18next.t('not_full_screen_view');
    } else {
      return i18next.t('full_screen_view');
    }
  }

  toggleView() {
    this.fullScreenActive = !this.fullScreenActive;
    this.classList.toggle('full-active');
    ELEMENTS_TO_HIDE.forEach(selector => {
      document.querySelector(selector).hidden = this.fullScreenActive;
    });
  }

  render() {
    return html`
        <button
          data-tooltip=${this.tooltip}
          data-position="left center"
          data-variation="mini"
          class="ui compact mini icon button"
          @click="${this.toggleView}">
            <i class="${this.fullScreenActive ? 'compress' : 'expand'} icon"></i>
        </button>
      `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }

}

customElements.define('ngm-full-screen-view', NgmFullScreenView);
