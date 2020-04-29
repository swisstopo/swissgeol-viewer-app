import {LitElement, css, html} from 'lit-element';
import {styleMap} from 'lit-html/directives/style-map';

import CesiumMath from 'cesium/Core/Math.js';
import Rectangle from 'cesium/Core/Rectangle.js';

import {SWITZERLAND_RECTANGLE} from '../constants'; // todo pass as prop

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
        display: flex;
        position: relative;
        overflow: hidden;
        user-select: none;
        border: 1px solid lightgrey;
        pointer-events: none;
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
    let markerWidth = this.clientWidth * this.widthScale;
    markerWidth = Math.min(Math.max(markerWidth, 35), 70);
    // apply restriction
    this.left = Math.min(Math.max(this.left, 0.02), 0.98);
    this.bottom = Math.min(Math.max(this.bottom, 0.04), 0.91);

    return {
      position: 'absolute',
      left: `calc(${this.left * 100}% - ${markerWidth / 2}px)`,
      bottom: `calc(${this.bottom * 100}% - ${markerWidth / 2}px)`,
      transform: `rotate(${this.heading}rad)`,
      width: `${markerWidth}px`
    };
  }

  updateFromCamera() {
    const position = this.scene.camera.positionCartographic;
    const lon = CesiumMath.toDegrees(position.longitude);
    const lat = CesiumMath.toDegrees(position.latitude);
    const cameraRect = this.scene.camera.computeViewRectangle(this.scene.globe.ellipsoid, new Rectangle());
    const cameraWest = CesiumMath.toDegrees(cameraRect.west);
    const cameraSouth = CesiumMath.toDegrees(cameraRect.south);
    this.left = (Math.max(cameraWest, lon) - this.extent[0]) / (this.extent[2] - this.extent[0]);
    this.bottom = (Math.max(cameraSouth, lat) - this.extent[1]) / (this.extent[3] - this.extent[1]);
    this.heading = this.scene.camera.heading;
    this.widthScale = cameraRect.width / SWITZERLAND_RECTANGLE.width;

    this.requestUpdate();
  }

  render() {
    return html`
      <div id="cesium-minimap-marker" style=${styleMap(this.markerStyle)}>
        <slot name="marker"></slot>
      </div>
      <slot name="image"></slot>
    `;
  }

}

customElements.define('cesium-minimap', CesiumMinimap);
