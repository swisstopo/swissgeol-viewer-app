import {customElement, html, state, property} from 'lit-element';
import {Event, Viewer} from 'cesium';
import Rectangle from 'cesium/Source/Core/Rectangle';
import CesiumMath from 'cesium/Source/Core/Math';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import {styleMap} from 'lit-html/directives/style-map';
import {SWITZERLAND_RECTANGLE, MINIMAP_EXTENT} from '../constants';
import draggable from './draggable';
import './ngm-nadir-view.ts';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n';

@customElement('ngm-minimap')
export class NgmMinimap extends LitElementI18n {
  @property({type: Object}) viewer: Viewer | null = null
  @state() moveMarker = false
  @state() left = 0
  @state() bottom = 0
  @state() widthScale = 0
  @state() heading = 0
  private unlistenPostRender: Event.RemoveCallback | null = null

  constructor() {
    super();
    this.addEventListener('mousemove', (evt: any) => {
      if (this.moveMarker && evt.target && evt.target.classList.contains('ngm-map-marker')) {
        this.moveCamera(evt.x, evt.y);
      }
    });
    this.addEventListener('click', (evt: any) => {
      if (!this.moveMarker && evt.target && evt.target.classList.contains('ngm-map-overview')) {
        this.moveCamera(evt.x, evt.y);
      }
    });
    this.addEventListener('mouseup', () => this.moveMarker = false);
    this.addEventListener('mouseout', () => this.moveMarker = false);
  }

  updated() {
    if (this.viewer && !this.unlistenPostRender) {
      this.unlistenPostRender = this.viewer.scene.postRender.addEventListener(() => {
        this.updateFromCamera();
      });
    }
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
    const maxWidth = 70;
    markerWidth = Math.min(Math.max(markerWidth, 35), maxWidth);
    this.left = Math.min(Math.max(this.left, 0.02), 0.98);
    this.bottom = Math.min(Math.max(this.bottom, 0.22), 0.74);

    return {
      position: 'absolute',
      left: `calc(${this.left * 100}% - ${markerWidth / 2}px)`,
      bottom: `calc(${this.bottom * 100}% - ${markerWidth / 2}px)`,
      transform: `rotate(${this.heading}rad)`,
      width: `${markerWidth}px`
    };
  }

  updateFromCamera() {
    if (!this.viewer) return;
    const cameraRect = this.viewer.scene.camera.computeViewRectangle(this.viewer.scene.globe.ellipsoid, new Rectangle());
    const position = this.viewer.scene.camera.positionCartographic;
    let lon = CesiumMath.toDegrees(position.longitude);
    let lat = CesiumMath.toDegrees(position.latitude);
    if (cameraRect) {
      this.widthScale = cameraRect.width / SWITZERLAND_RECTANGLE.width;
      // fixes camera position when low pitch and zoomed out
      const cameraWest = CesiumMath.toDegrees(cameraRect.west);
      const cameraSouth = CesiumMath.toDegrees(cameraRect.south);
      lon = Math.max(lon, cameraWest);
      lat = Math.max(lat, cameraSouth);
    }
    this.left = (lon - MINIMAP_EXTENT[0]) / (MINIMAP_EXTENT[2] - MINIMAP_EXTENT[0]);
    this.bottom = (lat - MINIMAP_EXTENT[1]) / (MINIMAP_EXTENT[3] - MINIMAP_EXTENT[1]);
    this.heading = this.viewer.scene.camera.heading;
  }

  moveCamera(evtX, evtY) {
    if (!this.viewer) return;
    const boundingRect = this.getBoundingClientRect();
    const camera = this.viewer.scene.camera;
    const cameraRect = camera.computeViewRectangle(this.viewer.scene.globe.ellipsoid, new Rectangle());
    let pinchScaleW = 1;
    let pinchScaleH = 1;
    if (cameraRect) {
      const position = camera.positionCartographic;
      pinchScaleW = cameraRect.west > position.longitude ? position.longitude / cameraRect.west : 1;
      pinchScaleH = cameraRect.south > position.latitude ? position.latitude / cameraRect.south : 1;
    }
    // calculate left, bottom percentage from event
    const left = (evtX - boundingRect.left) / (boundingRect.right - boundingRect.left);
    const bottom = (evtY - boundingRect.bottom) / (boundingRect.top - boundingRect.bottom);
    // calculate difference between minimap extent and map
    const leftDiff = CesiumMath.toRadians(MINIMAP_EXTENT[0]) - SWITZERLAND_RECTANGLE.west;
    const bottomDiff = CesiumMath.toRadians(MINIMAP_EXTENT[1]) - SWITZERLAND_RECTANGLE.south;
    // get distance to point in radians
    const width = CesiumMath.toRadians(MINIMAP_EXTENT[2] - MINIMAP_EXTENT[0]) * left + leftDiff;
    const height = CesiumMath.toRadians(MINIMAP_EXTENT[3] - MINIMAP_EXTENT[1]) * bottom + bottomDiff;
    const lon = (width + SWITZERLAND_RECTANGLE.west) * pinchScaleW;
    const lat = (height + SWITZERLAND_RECTANGLE.south) * pinchScaleH;
    camera.position = Cartesian3.fromRadians(lon, lat, camera.positionCartographic.height);
  }

  connectedCallback() {
    draggable(this, {
      allowFrom: '.ngm-drag-area'
    });
    super.connectedCallback();
  }

  render() {
    return html`
      <div class="ngm-minimap-header">
        ${i18next.t('minimap_orientation')}
        <div class="ngm-close-icon" @click=${() => this.dispatchEvent(new CustomEvent('close'))}></div>
      </div>
      <div class="ngm-minimap-container">
        <div style=${styleMap(this.markerStyle)} @mousedown="${() => this.moveMarker = true}">
          <img src="./images/mapMarker.svg" class="ngm-map-marker">
        </div>
        <img src="./images/overview.svg" class="ngm-map-overview">
        <ngm-nadir-view .viewer=${this.viewer}></ngm-nadir-view>
      </div>
      <div class="ngm-drag-area">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }

}
