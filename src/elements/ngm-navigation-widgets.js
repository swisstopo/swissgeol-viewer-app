import {LitElement, html} from 'lit-element';
import FirstPersonCameraMode from '../FirstPersonCameraMode.js';
import './cesium-compass.js';
import './ngm-zoom-buttons.js';

class NgmNavigationWidgets extends LitElement {

  static get properties() {
    return {
      viewer: {type: Object}
    };
  }

  constructor() {
    super();
    this.fpsMode = null;
  }

  updated() {
    if (this.viewer && !this.fpsMode) {
      this.fpsMode = new FirstPersonCameraMode(this.viewer.scene);
    }
  }

  activateFpsMode() {
    this.fpsMode.active = true;
  }

  render() {
    if (this.viewer) {
      return html`
        <cesium-compass .scene="${this.viewer.scene}" .clock="${this.viewer.clock}"></cesium-compass>
        <ngm-zoom-buttons .scene="${this.viewer.scene}"></ngm-zoom-buttons>
        <button class="ui compact mini icon button" @click="${this.activateFpsMode}">
          <i class="eye icon"></i>
        </button>
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
