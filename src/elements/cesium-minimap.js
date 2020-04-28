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
    const markerElement = this.renderRoot.querySelector('#cesium-minimap-marker');
    if (markerElement) {
      const halfOfWidth = markerElement.clientWidth / 2;
      return {
        position: 'absolute',
        left: `calc(${this.left * 100}% - ${halfOfWidth}px)`,
        bottom: `calc(${this.bottom * 100}% - ${halfOfWidth}px)`,
        transform: `rotate(${-CesiumMath.PI_OVER_TWO + this.heading}rad)`,
      };
    }
    return {};
  }
  updateFromCamera() {
    const position = this.scene.camera.positionCartographic;
    const lon = CesiumMath.toDegrees(position.longitude);
    const lat = CesiumMath.toDegrees(position.latitude);

    this.left = (lon - this.extent[0]) / (this.extent[2] - this.extent[0]);
    this.bottom = (lat - this.extent[1]) / (this.extent[3] - this.extent[1]);
    this.heading = this.scene.camera.heading;

    // apply restriction
    const minValue = 0.01;
    const maxValue = 1;
    this.left = Math.min(Math.max(this.left, minValue), maxValue);
    this.bottom = Math.min(Math.max(this.bottom, minValue), maxValue);

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
