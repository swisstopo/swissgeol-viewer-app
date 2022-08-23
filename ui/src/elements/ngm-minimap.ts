import {html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {Rectangle, Math as CesiumMath, Cartesian3} from 'cesium';
import {styleMap} from 'lit/directives/style-map.js';
import {MINIMAP_EXTENT} from '../constants';
import draggable from './draggable';
import './ngm-nadir-view';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n';
import NavToolsStore from '../store/navTools';
import type {Interactable} from '@interactjs/types';
import type {Event, Viewer} from 'cesium';
import {dragArea} from './helperElements';

// calculate difference between minimap extent and container
const width = CesiumMath.toRadians(MINIMAP_EXTENT[2] - MINIMAP_EXTENT[0]);
const height = CesiumMath.toRadians(MINIMAP_EXTENT[3] - MINIMAP_EXTENT[1]);
const west = CesiumMath.toRadians(MINIMAP_EXTENT[0]) - width / 228 * 12;
const south = CesiumMath.toRadians(MINIMAP_EXTENT[1]) - height / 99 * 24;
const east = CesiumMath.toRadians(MINIMAP_EXTENT[2]) + width / 228 * 12;
const north = CesiumMath.toRadians(MINIMAP_EXTENT[3]) + height / 99 * 36;

@customElement('ngm-minimap')
export class NgmMinimap extends LitElementI18n {
  @property({type: Object}) viewer: Viewer | null = null;
  @state() interaction: Interactable | null = null;
  @state() moveMarker = false;
  @state() left = 0;
  @state() bottom = 0;
  @state() heading = 0;
  private unlistenPostRender: Event.RemoveCallback | null = null;

  constructor() {
    super();
    this.addEventListener('mousemove', (evt: MouseEvent) => {
      if (this.moveMarker && evt.target && (evt.target as Element).classList.contains('ngm-cam-icon')) {
        this.moveCamera(evt.x, evt.y, 'mousemove');
      }
    });
    this.addEventListener('click', (evt: MouseEvent) => {
      if (!this.moveMarker && evt.target && (evt.target as Element).classList.contains('ngm-map-overview')) {
        NavToolsStore.hideTargetPoint();
        this.moveCamera(evt.x, evt.y, 'click');
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
    const markerWidth = 48;
    // apply restriction
    this.left = Math.min(Math.max(this.left, 0.05), 0.94);
    this.bottom = Math.min(Math.max(this.bottom, 0.1), 0.92);

    return {
      position: 'absolute',
      left: `calc(${this.left * 100}% - ${markerWidth / 2}px)`,
      bottom: `calc(${this.bottom * 100}% - ${markerWidth / 2}px)`,
      transform: `rotate(${this.heading}rad)`,
      width: `${markerWidth}px`,
      height: `${markerWidth}px`,
    };
  }

  updateFromCamera() {
    if (!this.viewer) return;
    const cameraRect = this.viewer.scene.camera.computeViewRectangle(this.viewer.scene.globe.ellipsoid, new Rectangle());
    const position = this.viewer.scene.camera.positionCartographic;
    let lon = CesiumMath.toDegrees(position.longitude);
    let lat = CesiumMath.toDegrees(position.latitude);
    if (cameraRect) {
      // fixes camera position when low pitch and zoomed out
      lon = Math.max(lon, CesiumMath.toDegrees(cameraRect.west));
      lat = Math.max(lat, CesiumMath.toDegrees(cameraRect.south));
    }
    this.left = (lon - MINIMAP_EXTENT[0]) / (MINIMAP_EXTENT[2] - MINIMAP_EXTENT[0]);
    this.bottom = (lat - MINIMAP_EXTENT[1]) / (MINIMAP_EXTENT[3] - MINIMAP_EXTENT[1]);
    this.heading = this.viewer.scene.camera.heading - 1.57;
  }

  moveCamera(evtX: number, evtY: number, evtType: string) {
    if (!this.viewer) return;
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
    const boundingRect = this.getBoundingClientRect();
    const x = evtType === 'mousemove' ? evtX + Math.sin(camera.heading) * 12 : evtX;
    const y = evtType === 'mousemove' ? evtY - Math.cos(camera.heading) * 12 : evtY;
    const left = (x - boundingRect.left) / (boundingRect.right - boundingRect.left);
    const bottom = (y - boundingRect.bottom) / (boundingRect.top - boundingRect.bottom);

    // get distance to point in radians
    const lon = (west + (east - west) * left) * pinchScaleW;
    const lat = (south + (north - south) * bottom) * pinchScaleH;
    camera.position = Cartesian3.fromRadians(lon, lat, camera.positionCartographic.height);
  }

  connectedCallback() {
    draggable(this, {
      allowFrom: '.drag-handle'
    });
    super.connectedCallback();
  }

  onIconPress(evt) {
    NavToolsStore.hideTargetPoint();
    this.moveCamera(evt.x, evt.y, 'mousemove');
    this.moveMarker = true;
  }

  render() {
    return html`
      <div class="ngm-floating-window-header drag-handle">
        ${i18next.t('minimap_orientation')}
        <div class="ngm-close-icon" @click=${() => this.dispatchEvent(new CustomEvent('close'))}></div>
      </div>
      <div class="ngm-minimap-container">
        <img src="./images/overview.svg" class="ngm-map-overview">
        <div class="ngm-cam-icon" style=${styleMap(this.markerStyle)}
             @mousedown="${(evt) => this.onIconPress(evt)}">
        </div>
        <ngm-nadir-view .viewer=${this.viewer}></ngm-nadir-view>
      </div>
      ${dragArea}
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }

}
