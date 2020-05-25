import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import CesiumMath from 'cesium/Core/Math.js';
import {unsafeHTML} from 'lit-html/directives/unsafe-html.js';
import {formatCartographicAs2DLv95} from '../projection.js';


class NgmCameraInformation extends I18nMixin(LitElement) {

  static get properties() {
    return {
      scene: {type: Object},
      elevation: {type: Number},
      heading: {type: Number},
      coordinates: {type: String},
    };
  }

  constructor() {
    super();

    /** @type {import('cesium/Scene/Scene.js').default} */
    this.scene;

    this.elevation = undefined;
    this.heading = undefined;
    this.coordinates = undefined;
    this.unlistenPostRender = null;

    // always use the 'de-CH' locale to always have the simple tick as thousands separator
    this.integerFormat = new Intl.NumberFormat('de-CH', {
      maximumFractionDigits: 0
    });
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
    const altitude = this.scene.globe.getHeight(this.scene.camera._positionCartographic);
    if (altitude !== undefined) {
      // globe is ready
      const camera = this.scene.camera;
      this.elevation = camera._positionCartographic.height - altitude;
      this.heading = CesiumMath.toDegrees(this.scene.camera.heading);
      this.coordinates = formatCartographicAs2DLv95(camera.positionCartographic);
    }
  }

  render() {
    if (this.elevation !== undefined && this.heading !== undefined) {
      const coordinates = this.coordinates;
      const height = this.integerFormat.format(this.elevation);
      let angle = this.integerFormat.format(this.heading);
      if (angle === '360') {
        // the integer format can cause that
        angle = '0';
      }

      return html`
         ${unsafeHTML(i18next.t('camera_position', {coordinates, height, angle}))}
        <ngm-position-edit .scene="${this.scene}"></ngm-position-edit>
      `;
    } else {
      return html``;
    }
  }

  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-camera-information', NgmCameraInformation);
