import {LitElement, css, html} from 'lit-element';
import {styleMap} from 'lit-html/directives/style-map';
import {classMap} from 'lit-html/directives/class-map';

import CesiumMath from 'cesium/Core/Math.js';
import Rectangle from 'cesium/Core/Rectangle.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';

class CesiumMinimap extends LitElement {

  static get properties() {
    return {
      scene: {type: Object},
      extent: {type: Array},
      mapRectangle: {type: Object}
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
      .hidden {
        display: none;
      }
      .change-size-icon {
        position: absolute;
        right: 0;
        width: 20px;
        height: 20px;
        color: lightgrey;
      }
    `;
  }

  constructor() {
    super();
    this.unlistenPostRender = null;
    this.expanded = true;
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
      const path = evt.composedPath ? evt.composedPath() : evt.path;
      const includeIcon = path.find(el => el.classList && el.classList.contains('change-size-icon'));
      if (!this.moveMarker && !includeIcon) {
        this.moveCamera(evt.x, evt.y);
      }
    });
    this.addEventListener('mouseup', () => this.moveMarker = false);
    this.addEventListener('mouseout', () => this.moveMarker = false);
  }

  disconnectedCallback() {
    if (this.unlistenPostRender) {
      this.unlistenPostRender();
    }
    super.disconnectedCallback();
  }

  get markerStyle() {
    // calculate width according to current view
    let markerWidth = this.clientWidth * this.widthScale;
    // apply restriction
    const maxWidth = this.expanded ? 70 : 50;
    markerWidth = Math.min(Math.max(markerWidth, 35), maxWidth);
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
    const position = this.scene.camera.positionCartographic;
    let lon = CesiumMath.toDegrees(position.longitude);
    let lat = CesiumMath.toDegrees(position.latitude);
    if (cameraRect) {
      this.widthScale = cameraRect.width / this.mapRectangle.width;
      // fixes camera position when low pitch and zoomed out
      const cameraWest = CesiumMath.toDegrees(cameraRect.west);
      const cameraSouth = CesiumMath.toDegrees(cameraRect.south);
      lon = Math.max(lon, cameraWest);
      lat = Math.max(lat, cameraSouth);
    }
    this.left = (lon - this.extent[0]) / (this.extent[2] - this.extent[0]);
    this.bottom = (lat - this.extent[1]) / (this.extent[3] - this.extent[1]);
    this.heading = this.scene.camera.heading;

    this.requestUpdate();
  }

  moveCamera(evtX, evtY) {
    const boundingRect = this.getBoundingClientRect();
    const cameraRect = this.scene.camera.computeViewRectangle(this.scene.globe.ellipsoid, new Rectangle());
    let pinchScaleW = 1;
    let pinchScaleH = 1;
    if (cameraRect) {
      const position = this.scene.camera.positionCartographic;
      pinchScaleW = cameraRect.west > position.longitude ? position.longitude / cameraRect.west : 1;
      pinchScaleH = cameraRect.south > position.latitude ? position.latitude / cameraRect.south : 1;
    }
    // calculate left, bottom percentage from event
    const left = (evtX - boundingRect.left) / (boundingRect.right - boundingRect.left);
    const bottom = (evtY - boundingRect.bottom) / (boundingRect.top - boundingRect.bottom);
    // calculate difference between minimap extent and map
    const leftDiff = CesiumMath.toRadians(this.extent[0]) - this.mapRectangle.west;
    const bottomDiff = CesiumMath.toRadians(this.extent[1]) - this.mapRectangle.south;
    // get distance to point in radians
    const width = CesiumMath.toRadians(this.extent[2] - this.extent[0]) * left + leftDiff;
    const height = CesiumMath.toRadians(this.extent[3] - this.extent[1]) * bottom + bottomDiff;
    const lon = (width + this.mapRectangle.west) * pinchScaleW;
    const lat = (height + this.mapRectangle.south) * pinchScaleH;
    this.scene.camera.position = Cartesian3.fromRadians(lon, lat, this.scene.camera.positionCartographic.height);
  }

  changeMinimapSize() {
    const overviewElem = this.querySelector('[slot="image"]');
    overviewElem.style.width = this.expanded ? '100px' : 'auto';
    this.expanded = !this.expanded;
    this.requestUpdate();
  }

  render() {
    return html`
      <div style=${styleMap(this.markerStyle)}
       @mousedown="${() => this.moveMarker = true}">
        <slot name="marker"></slot>
      </div>
      <div class="change-size-icon" @click="${this.changeMinimapSize}">
        <slot class=${classMap({hidden: !this.expanded})}
          name="collapse-icon">
        </slot>
        <slot
          class=${classMap({hidden: this.expanded})}
          name="expand-icon">
        </slot>
      </div>
      <slot name="image"></slot>
    `;
  }

}

customElements.define('cesium-minimap', CesiumMinimap);
