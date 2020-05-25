import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';

import Cartesian2 from 'cesium/Core/Cartesian2.js';
import Transforms from 'cesium/Core/Transforms.js';
import Matrix4 from 'cesium/Core/Matrix4.js';
import CesiumMath from 'cesium/Core/Math.js';

class NgmNadirView extends I18nMixin(LitElement) {
  static get properties() {
    return {
      scene: {type: Object},
      active: {type: Boolean}
    };
  }

  constructor() {
    super();

    this.pitch = undefined;
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
    if (this.active && !CesiumMath.equalsEpsilon(this.scene.camera.pitch, -Math.PI / 2, CesiumMath.EPSILON1)) {
      this.active = false;
    }
  }

  tooltip() {
    if (this.active) {
      return i18next.t('nadir_deactivate_btn');
    } else {
      return i18next.t('nadir_activate_btn');
    }
  }

  viewCenter() {
    const windowPosition = new Cartesian2(
      this.scene.canvas.clientWidth / 2,
      this.scene.canvas.clientHeight / 2
    );
    const ray = this.scene.camera.getPickRay(windowPosition);
    const center = this.scene.globe.pick(ray, this.scene);
    return center !== undefined ? center : this.scene.camera.positionWC;
  }

  toggle() {
    const camera = this.scene.camera;
    const transform = Transforms.eastNorthUpToFixedFrame(this.viewCenter());
    const oldTransform = Matrix4.clone(camera.transform);
    camera.lookAtTransform(transform);

    if (this.active) {
      camera.rotateUp(this.pitch + Math.PI / 2);
      this.pitch = undefined;
    } else {
      this.pitch = camera.pitch;
      camera.rotateDown(this.pitch + Math.PI / 2);
    }
    camera.lookAtTransform(oldTransform);

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
