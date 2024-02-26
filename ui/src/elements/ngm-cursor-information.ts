import {html} from 'lit';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import type {Viewer} from 'cesium';
import {Cartographic, ScreenSpaceEventHandler, ScreenSpaceEventType, VoxelPrimitive} from 'cesium';
import {customElement, property, state} from 'lit/decorators.js';
import {getValueOrUndefined} from '../geoblocks/cesium-helpers/cesiumutils';
import {formatCartographicAs2DLv95} from '../projection';

@customElement('ngm-cursor-information')
export class NgmCursorInformation extends LitElementI18n {
  @property({type: Object})
  accessor viewer: Viewer | undefined;
  @state()
  accessor coordinates: string[] = [];
  @state()
  accessor showTerrainHeight = false;
  @state()
  accessor height: number | undefined;
  private eventHandler: ScreenSpaceEventHandler | undefined;
  private cameraMoving = false;
  private unlistenMoveStart: any;
  private unlistenMoveEnd: any;
  // always use the 'de-CH' locale to always have the simple tick as thousands separator
  private integerFormat = new Intl.NumberFormat('de-CH', {
    maximumFractionDigits: 1
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
      if (cartesian && !(feature?.primitive instanceof VoxelPrimitive)) {
        this.coordinates = formatCartographicAs2DLv95(Cartographic.fromCartesian(cartesian));
        const position = Cartographic.fromCartesian(cartesian);
        const lineOrPolygon = getValueOrUndefined(feature?.id?.polyline?.show) || getValueOrUndefined(feature?.id?.polygon?.show);
        this.height = position.height;
        this.showTerrainHeight = !(feature && !lineOrPolygon);
        return;
      }
    }
    this.height = undefined;
  }


  render() {
    if (!this.coordinates || this.height === undefined) return '';
    return html`
        <div class="ngm-nci-position">
          <label>${i18next.t('camera_position_coordinates_label')}</label>
          <label class="ngm-nci-value">${this.coordinates[0]}</label>
          <label class="ngm-nci-value">${this.coordinates[1]}</label>
        </div>
        <div class="ngm-nci-height">
          <div>
            ${this.showTerrainHeight ? i18next.t('nav_terrain_height_label') : i18next.t('nav_object_height_label')}
          </div>
          <div .hidden=${this.height === undefined} class="ngm-nci-value">
            ${this.height !== undefined && this.integerFormat.format(this.height)} m
          </div>
        </div>
      `;
  }

  createRenderRoot() {
    return this;
  }
}
