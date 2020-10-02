import {I18nMixin} from '../i18n';
import i18next from 'i18next';
import {LitElement, html} from 'lit-element';

const ELEMENTS_TO_HIDE = ['ngm-navigation-widgets', 'ngm-review-window'];

class NgmFullScreenView extends I18nMixin(LitElement) {

  static get properties() {
    return {
      fullScreenActive: {type: Boolean}
    };
  }

  constructor() {
    super();

    this.fullScreenActive = false;
    document.onfullscreenchange = () => {
      this.fullScreenActive = !this.fullScreenActive;
      this.classList.toggle('full-active');
      document.querySelector('#cesium').classList.toggle('full-active');
      ELEMENTS_TO_HIDE.forEach(selector => {
        document.querySelector(selector).hidden = this.fullScreenActive;
      });
    };
  }

  get tooltip() {
    if (this.fullScreenActive) {
      return i18next.t('nav_not_full_screen_view_hint');
    } else {
      return i18next.t('nav_full_screen_view_hint');
    }
  }

  toggleView() {
    if (!this.fullScreenActive) {
      document.querySelector('#cesium').requestFullscreen();
    } else {
      document.exitFullscreen();
    }
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
