import {html} from 'lit';
import {LitElementI18n} from '../i18n.js';
import {
  Cartographic,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from 'cesium';
import {getValueOrUndefined} from '../cesiumutils';
import {customElement, property, state} from 'lit/decorators.js';
import type {Viewer} from 'cesium';


@customElement('ngm-feature-height')
export class NgmFeatureHeight extends LitElementI18n {
  @property({type: Object}) viewer: Viewer | undefined;
  @state() height: number | undefined;
  private eventHandler: ScreenSpaceEventHandler | undefined;
  private cameraMoving = false;
  private unlistenMoveStart: any;
  private unlistenMoveEnd: any;
  // always use the 'de-CH' locale to always have the simple tick as thousands separator
  private integerFormat = new Intl.NumberFormat('de-CH', {
    maximumFractionDigits: 0
  });

  updated() {
    if (this.viewer) {
      if (!this.eventHandler) {
        this.eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
        this.eventHandler.setInputAction(this.onMouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
      }
      if (!this.unlistenMoveStart && !this.unlistenMoveEnd) {
        this.unlistenMoveStart = this.viewer.camera.moveStart.addEventListener(() => this.cameraMoving = true);
        this.unlistenMoveEnd = this.viewer.camera.moveEnd.addEventListener(() => this.cameraMoving = false);
      }
    }
  }

  disconnectedCallback() {
    if (this.eventHandler) {
      this.eventHandler.destroy();
      this.eventHandler = undefined;
    }
    if (this.unlistenMoveStart && this.unlistenMoveEnd) {
      this.unlistenMoveStart();
      this.unlistenMoveStart = undefined;
      this.unlistenMoveEnd();
      this.unlistenMoveEnd = undefined;
    }
    super.disconnectedCallback();
  }

  onMouseMove(movement) {
    if (!this.cameraMoving && this.viewer) {
      const feature = this.viewer.scene.pick(movement.endPosition);
      const cartesian = this.viewer.scene.pickPosition(movement.endPosition);
      if (cartesian) {
        const position = Cartographic.fromCartesian(cartesian);
        const altitude = this.viewer.scene.globe.getHeight(position);
        if (altitude !== undefined) {
          const lineOrPolygon = getValueOrUndefined(feature?.id?.polyline?.show) || getValueOrUndefined(feature?.id?.polygon?.show);
          if (feature && !lineOrPolygon) {
            this.height = position.height - altitude;
            this.dispatchEvent(new CustomEvent('updatelabel', {detail: {terrainHeight: false}}));
          } else {
            this.height = position.height;
            this.dispatchEvent(new CustomEvent('updatelabel', {detail: {terrainHeight: true}}));
          }
          return;
        }
      }
    }
    this.height = undefined;
  }

  render() {
    if (this.height !== undefined) {
      return html`${this.integerFormat.format(this.height)} m`;
    } else {
      return html``;
    }
  }
}
