import {html} from 'lit-element';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import CesiumMath from 'cesium/Source/Core/Math';
import {unsafeHTML} from 'lit-html/directives/unsafe-html.js';
import {formatCartographicAs2DLv95} from '../projection.js';

class NgmCameraInformation extends LitElementI18n {

  static get properties() {
    return {
      viewer: {type: Object},
      elevation: {type: Number},
      heading: {type: Number},
      coordinates: {type: String},
    };
  }

  constructor() {
    super();

    this.viewer = null;

    /**
     * @type {import('cesium/Source/Scene/Scene').default}
     */
    this.scene = null;

    this.elevation = undefined;
    this.heading = undefined;
    this.pitch = undefined;
    this.coordinates = undefined;
    this.unlistenPostRender = null;

    // always use the 'de-CH' locale to always have the simple tick as thousands separator
    this.integerFormat = new Intl.NumberFormat('de-CH', {
      maximumFractionDigits: 0
    });
  }

  updated() {
    if (this.viewer && !this.unlistenPostRender) {
      this.scene = this.viewer.scene;
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
    const camera = this.scene.camera;
    let altitude = this.scene.globe.getHeight(camera.positionCartographic);
    altitude = altitude ? altitude : 0;
    this.elevation = camera.positionCartographic.height - altitude;
    this.heading = CesiumMath.toDegrees(camera.heading);
    this.pitch = CesiumMath.toDegrees(camera.pitch);
    this.coordinates = formatCartographicAs2DLv95(camera.positionCartographic);
  }

  render() {
    if (this.elevation !== undefined && this.heading !== undefined && this.pitch !== undefined) {
      const coordinates = this.coordinates;
      const height = this.integerFormat.format(this.elevation);
      let angle = this.integerFormat.format(this.heading);
      const pitch = this.integerFormat.format(this.pitch);
      if (angle === '360') {
        // the integer format can cause that
        angle = '0';
      }

      return html`
        <table class="">
          <tbody>
            <tr>
              <td>Coordinates</td>
              <td>Height</td>
              <td class="value">${height} m</td>
            </tr>
            <tr>
              <td class="value">${coordinates[0]}</td>
              <td>Angle</td>
              <td class="value">${angle}°</td>
            </tr>
            <tr>
              <td class="value">${coordinates[1]}</td>
              <td>Pitch</td>
              <td class="value">${pitch}°</td>
            </tr>
          </tbody>
        </table>
         <!-- ${unsafeHTML(i18next.t('nav_camera_position_label', {coordinates, height, angle, pitch}))} -->
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
