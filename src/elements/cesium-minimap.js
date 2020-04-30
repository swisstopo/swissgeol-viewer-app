import {LitElement, css, html} from 'lit-element';
import {styleMap} from 'lit-html/directives/style-map';

import CesiumMath from 'cesium/Core/Math.js';
import Rectangle from 'cesium/Core/Rectangle.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';

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
        cursor: pointer;
      }
      slot {
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
      this.unlistenPostRender = this.scene.postRender.addEventListener(() => {
        this.updateFromCamera();
      });
    }
    this.addEventListener('mousemove', (evt) => {
      if (this.moveMarker) {
        this.moveCamera(evt.x, evt.y);
      }
    });
    this.addEventListener('click', (evt) => {
      if (!this.moveMarker) {
        this.moveCamera(evt.x, evt.y);
      }
    });
    this.addEventListener('mouseup', () => this.moveMarker = false);
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
    const cameraRect = this.scene.camera.computeViewRectangle(this.scene.globe.ellipsoid, new Rectangle());
    const cameraLeftBottom = this.getCameraLeftBottom();
    this.left = cameraLeftBottom.left;
    this.bottom = cameraLeftBottom.bottom;
    this.heading = this.scene.camera.heading;
    this.widthScale = cameraRect.width / SWITZERLAND_RECTANGLE.width;
    this.requestUpdate();
  }

  getCameraLeftBottom() {
    const position = this.scene.camera.positionCartographic;
    const lon = CesiumMath.toDegrees(position.longitude);
    const lat = CesiumMath.toDegrees(position.latitude);
    const cameraRect = this.scene.camera.computeViewRectangle(this.scene.globe.ellipsoid, new Rectangle());
    const cameraWest = CesiumMath.toDegrees(cameraRect.west);
    const cameraSouth = CesiumMath.toDegrees(cameraRect.south);
    const left = (Math.max(cameraWest, lon) - this.extent[0]) / (this.extent[2] - this.extent[0]);
    const bottom = (Math.max(cameraSouth, lat) - this.extent[1]) / (this.extent[3] - this.extent[1]);
    return {left, bottom};
  }

  moveCamera(evtX, evtY) {
    const boundingRect = this.getBoundingClientRect();
    // calculate left, bottom percentage from event
    const left = (evtX - boundingRect.left) / (boundingRect.right - boundingRect.left);
    const bottom = (evtY - boundingRect.bottom) / (boundingRect.top - boundingRect.bottom);
    // calculate difference between minimap extent and map
    const leftDiff = CesiumMath.toRadians(this.extent[0]) - SWITZERLAND_RECTANGLE.west;
    const bottomDiff = CesiumMath.toRadians(this.extent[1]) - SWITZERLAND_RECTANGLE.south;
    // get distance to point in radians
    const width = CesiumMath.toRadians(this.extent[2] - this.extent[0]) * left + leftDiff;
    const height = CesiumMath.toRadians(this.extent[3] - this.extent[1]) * bottom + bottomDiff;
    const lon = width + SWITZERLAND_RECTANGLE.west;
    const lat = height + SWITZERLAND_RECTANGLE.south;
    this.scene.camera.position = Cartesian3.fromRadians(lon, lat, this.scene.camera.positionCartographic.height);
  }

  render() {
    return html`
      <div id="cesium-minimap-marker" style=${styleMap(this.markerStyle)}
       @mousedown="${() => this.moveMarker = true}">
        <slot name="marker"></slot>
      </div>
      <slot name="image"></slot>
    `;
  }

}

customElements.define('cesium-minimap', CesiumMinimap);
