import {LitElement, css, html} from 'lit-element';
import {styleMap} from 'lit-html/directives/style-map';

import CesiumMath from 'cesium/Core/Math.js';

class CesiumMinimap extends LitElement {

  static get properties() {
    return {
      scene: {type: Object},
      extent: {type: Array}
    };
  }

  static get styles() {
    return css`
      :host {
        position: relative;
        overflow: hidden;
        user-select: none;
      }
    `;
  }

  constructor() {
    super();
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

  get markerStyle() {
    return {
      position: 'absolute',
      left: `${this.left * 100}%`,
      bottom: `${this.bottom * 100}%`,
      transform: `rotate(${-CesiumMath.PI_OVER_TWO + this.heading}rad)`,
    };
  }
  updateFromCamera() {
    const position = this.scene.camera.positionCartographic;
    const lon = CesiumMath.toDegrees(position.longitude);
    const lat = CesiumMath.toDegrees(position.latitude);

    this.left = (lon - this.extent[0]) / (this.extent[2] - this.extent[0]);
    this.bottom = (lat - this.extent[1]) / (this.extent[3] - this.extent[1]);
    this.heading = this.scene.camera.heading;

    if (this.left < 0) { // TODO make it better
      this.left = 0;
    } else if (this.left > 0.95) {
      this.left = 0.95;
    }

    if (this.bottom < 0) {
      this.bottom = 0;
    } else if (this.bottom > 0.95) {
      this.bottom = 0.95;
    }

    this.requestUpdate();
  }

  render() {
    return html`
      <div style=${styleMap(this.markerStyle)}>
        <slot name="marker"></slot>
      </div>
      <slot name="image"></slot>
    `;
  }

}

customElements.define('cesium-minimap', CesiumMinimap);
