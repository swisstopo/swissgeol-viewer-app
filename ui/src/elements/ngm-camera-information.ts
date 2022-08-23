import {html} from 'lit';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import {Math as CesiumMath} from 'cesium';
import {formatCartographicAs2DLv95} from '../projection';
import './ngm-feature-height';
import {customElement, property, state} from 'lit/decorators.js';
import type {Scene, Viewer} from 'cesium';

@customElement('ngm-camera-information')
export class NgmCameraInformation extends LitElementI18n {
  @property({type: Object}) viewer: Viewer | undefined;
  @state() elevation = 0;
  @state() heading = 0;
  @state() pitch = 0;
  @state() coordinates: string[] = [];
  @state() showTerrainHeight = false;
  private scene: Scene | undefined;
  private unlistenPostRender: any | undefined;
  // always use the 'de-CH' locale to always have the simple tick as thousands separator
  private integerFormat = new Intl.NumberFormat('de-CH', {
    maximumFractionDigits: 0
  });

  updated() {
    if (this.viewer && !this.unlistenPostRender) {
      this.scene = this.viewer.scene;
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
    if (!this.scene) return;
    const camera = this.scene.camera;
    let altitude = this.scene.globe.getHeight(camera.positionCartographic);
    altitude = altitude ? altitude : 0;
    this.elevation = camera.positionCartographic.height - altitude;
    const heading = CesiumMath.toDegrees(camera.heading);
    this.heading = heading > 180 ? heading - 360 : heading;
    this.pitch = CesiumMath.toDegrees(camera.pitch);
    this.coordinates = formatCartographicAs2DLv95(camera.positionCartographic);
  }

  render() {
    if (this.elevation !== undefined && this.heading !== undefined && this.pitch !== undefined) {
      const coordinates = this.coordinates;
      const height = this.integerFormat.format(this.elevation);
      let angle = this.integerFormat.format(this.heading);
      const pitch = this.integerFormat.format(this.pitch);
      if (angle === '360') {
        // the integer format can cause that
        angle = '0';
      }

      return html`
        <div class="ngm-nci-position">
          <label>${i18next.t('camera_position_coordinates_label')}</label>
          <label class="ngm-nci-value">${coordinates[0]}</label>
          <label class="ngm-nci-value">${coordinates[1]}</label>
        </div>
        <div class="ngm-nci-direction">
          <div class="ngm-nci-direction-labels">
            <div>${i18next.t('camera_position_height_label')}</div>
            <div>${i18next.t('camera_position_angle_label')}, ${i18next.t('camera_position_pitch_label')}</div>
            <div>
              ${this.showTerrainHeight ? i18next.t('nav_terrain_height_label') : i18next.t('nav_object_height_label')}
            </div>
          </div>
          <div>
            <div class="ngm-nci-value ngm-nci-height">${height} m</div>
            <div class="ngm-nci-value">${angle}°, ${pitch}°</div>
            <div class="ngm-nci-value">
              <ngm-feature-height .viewer=${this.viewer}
                                  @updatelabel=${evt => this.showTerrainHeight = evt.detail.terrainHeight}>
              </ngm-feature-height>
            </div>
          </div>
        </div>
      `;
    } else {
      return html``;
    }
  }

  createRenderRoot() {
    return this;
  }
}
