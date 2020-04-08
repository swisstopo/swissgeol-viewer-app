import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import CesiumMath from 'cesium/Core/Math.js';


class NgmCameraInformation extends I18nMixin(LitElement) {

  static get properties() {
    return {
      scene: {type: Object},
      elevation: {type: Number},
      heading: {type: Number}
    };
  }

  constructor() {
    super();

    this.elevation = undefined;
    this.heading = undefined;
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
      this.elevation = this.scene.camera._positionCartographic.height - altitude;
      // flip the angle to have a similar angle to a real compass
      this.heading = CesiumMath.toDegrees(CesiumMath.TWO_PI - this.scene.camera.heading);
    }
  }

  render() {
    if (this.elevation !== undefined && this.heading !== undefined) {
      return html`
        ${i18next.t('Your position')}: ${this.integerFormat.format(this.elevation)} m, ${this.integerFormat.format(this.heading)}°
      `;
    } else {
      return html``;
    }
  }
}

customElements.define('ngm-camera-information', NgmCameraInformation);
