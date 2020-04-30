import {LitElement, html} from 'lit-element';
import '@geoblocks/cesium-compass';
import './cesium-view-cube.js';
import './cesium-minimap.js';
import './ngm-zoom-buttons.js';
import './ngm-elevator-buttons.js';
import './ngm-keyboard-info-popup.js';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import {SWITZERLAND_RECTANGLE} from '../constants.js';

class NgmNavigationWidgets extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object}
    };
  }

  render() {
    if (this.viewer) {
      return html`
        <cesium-minimap
        .scene="${this.viewer.scene}"
        extent="[5.910642046, 45.791912227, 10.554524194, 47.804750923]"
        .mapRectangle="${SWITZERLAND_RECTANGLE}">
          <i slot="collapse-icon" class="compress arrows alternate icon"></i>
          <i slot="expand-icon" class="expand arrows alternate icon"></i>
          <img slot="marker" src="src/images/mapMarker.svg">
          <img slot="image" src="src/images/overview.svg">
        </cesium-minimap>
        <div class="ngm-navigation-buttons">
          <div id="compass-info-popup"></div>
          <cesium-view-cube .scene="${this.viewer.scene}"></cesium-view-cube>
          <cesium-compass .scene="${this.viewer.scene}" .clock="${this.viewer.clock}"
          data-tooltip=${i18next.t('cesium_compass_tooltip')}
          data-position="left center"
          data-variation="mini"
          ></cesium-compass>
          <ngm-zoom-buttons .scene="${this.viewer.scene}"></ngm-zoom-buttons>
          <ngm-elevator-buttons .scene="${this.viewer.scene}"></ngm-elevator-buttons>
          <ngm-keyboard-info-popup></ngm-keyboard-info-popup>
        </div>
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
