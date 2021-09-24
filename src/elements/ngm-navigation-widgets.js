import {html} from 'lit-element';
import '@geoblocks/cesium-compass';
import '@geoblocks/cesium-view-cube';
import './ngm-zoom-buttons.js';
import './ngm-elevator-buttons.js';
import './ngm-keyboard-info-popup.js';
import './ngm-nadir-view.js';
import './slicer/ngm-slicer.js';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import MainStore from '../store/main.ts';

class NgmNavigationWidgets extends LitElementI18n {

  constructor() {
    super();
    /**
     * @type {import('cesium').Viewer}
     */
    this.viewer = null;
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
  }

  render() {
    if (this.viewer) {
      return html`
        <div class="ngm-navigation-buttons">
          <div id="compass-info-popup"></div>
          <cesium-view-cube .scene="${this.viewer.scene}"></cesium-view-cube>
          <cesium-compass .scene="${this.viewer.scene}" .clock="${this.viewer.clock}"
                          data-tooltip=${i18next.t('nav_cesium_compass_hint')}
                          data-position="left center"
                          data-variation="mini"
          ></cesium-compass>
          <ngm-zoom-buttons .scene="${this.viewer.scene}"></ngm-zoom-buttons>
          <ngm-elevator-buttons .scene="${this.viewer.scene}"></ngm-elevator-buttons>
          <ngm-nadir-view .scene="${this.viewer.scene}"></ngm-nadir-view>
          <ngm-slicer></ngm-slicer>
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
