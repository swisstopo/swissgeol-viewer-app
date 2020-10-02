import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import {setCameraHeight, aroundCenter} from '../utils.js';

import CesiumMath from 'cesium/Source/Core/Math';

class NgmNadirView extends I18nMixin(LitElement) {
  static get properties() {
    return {
      scene: {type: Object},
      active: {type: Boolean}
    };
  }

  constructor() {
    super();

    /**
     * @type {import('cesium/Source/Scene/Scene').default}
     */
    this.scene;

    this.pitch = undefined;
    this.height = undefined;
    this.active = false;
    this.unlistenPostRender = null;
  }

  updated() {
    if (this.scene && !this.unlistenPostRender) {
      this.unlistenPostRender = this.scene.postRender.addEventListener(() => this.updateFromCamera());
    }
  }

  disconnectedCallback() {
    if (this.unlistenPostRender) {
      this.unlistenPostRender();
    }
    super.disconnectedCallback();
  }


  updateFromCamera() {
    if (this.active && !CesiumMath.equalsEpsilon(this.scene.camera.pitch, -CesiumMath.PI_OVER_TWO, CesiumMath.EPSILON1)) {
      this.pitch = undefined;
      this.height = undefined;
      this.active = false;
    }
  }

  tooltip() {
    if (this.active) {
      return i18next.t('nav_nadir_deactivate_hint');
    } else {
      return i18next.t('nav_nadir_activate_hint');
    }
  }

  toggle() {
    const camera = this.scene.camera;

    if (this.active) {
      aroundCenter(this.scene, this.height !== undefined, () => {
        camera.rotateUp(this.pitch + CesiumMath.PI_OVER_TWO);
      });
      this.pitch = undefined;

      if (this.height !== undefined) {
        setCameraHeight(camera, this.height);
      }
      this.height = undefined;
    } else {
      if (this.scene.cameraUnderground) {
        this.height = camera.positionCartographic.height;
        setCameraHeight(camera, 10000);
      }

      this.pitch = camera.pitch;
      aroundCenter(this.scene, this.scene.cameraUnderground, () => {
        camera.rotateDown(this.pitch + CesiumMath.PI_OVER_TWO);
      });
    }

    this.active = !this.active;
  }

  render() {
    if (this.scene) {
      return html`
        <button
          data-tooltip=${this.tooltip()}
          data-position="left center"
          data-variation="mini"
          class="ui compact mini icon button ${this.active ? 'grey' : ''}"
          @click="${this.toggle}">
            <i class="icon binoculars"></i>
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

customElements.define('ngm-nadir-view', NgmNadirView);
