import {LitElement, html} from 'lit-element';
import './cesium-compass.js';
import './ngm-zoom-buttons.js';
import './ngm-elevator-buttons.js';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';

class NgmNavigationWidgets extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object}
    };
  }

  render() {
    if (this.viewer) {
      return html`
        <div id="compass-info-popup"></div>
        <cesium-compass .scene="${this.viewer.scene}" .clock="${this.viewer.clock}"
        data-tooltip=${i18next.t('cesium_compass_tooltip')}
        data-position="left center"
        data-variation="mini"
        ></cesium-compass>
        <ngm-zoom-buttons .scene="${this.viewer.scene}"></ngm-zoom-buttons>
        <ngm-elevator-buttons .scene="${this.viewer.scene}"></ngm-elevator-buttons>
      `;
    } else {
      return html``;
    }
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-navigation-widgets', NgmNavigationWidgets);
