import {customElement, property, state} from 'lit/decorators.js';
import {html} from 'lit';

import {LitElementI18n} from '../i18n.js';
import {updateHeightForCartesianPositions} from '../geoblocks/cesium-helpers/cesiumutils';

import {Math as CesiumMath, Cartesian3} from 'cesium';
import {styleMap} from 'lit/directives/style-map.js';
import type {Event, Viewer} from 'cesium';
import {getTargetParam} from '../permalink';
import NavToolsStore from '../store/navTools';

@customElement('ngm-nadir-view')
export class NgmNadirView extends LitElementI18n {
  @property({type: Object})
  accessor viewer: Viewer | null = null;
  @state()
  accessor unlistenPostRender: Event.RemoveCallback | null = null;
  @state()
  accessor northActive = false;
  @state()
  accessor nadirActive = false;
  @state()
  accessor pitch: number | undefined = undefined;
  @state()
  accessor height: number | undefined = undefined;
  @state()
  accessor heading: number | undefined = undefined;
  @state()
  accessor position: Cartesian3 | undefined = undefined;
  @state()
  accessor currentHeading = 0;

  updated() {
    if (this.viewer && !this.unlistenPostRender) {
      this.unlistenPostRender = this.viewer.scene.postRender.addEventListener(() => this.updateFromCamera());
    }
  }

  disconnectedCallback() {
    if (this.unlistenPostRender) {
      this.unlistenPostRender();
    }
    super.disconnectedCallback();
  }

  get compassStyle() {
    const angle = Math.round(this.currentHeading * 180 / Math.PI);
    return {
      'background-color': this.northActive && (angle === 0 || angle === 360) ? '#FFFFFF' : 'var(--ngm-interaction)',
    };
  }

  get nadirCameraStyle() {
    const pitch = this.viewer!.scene.camera.pitch;
    const isNadirPitch = CesiumMath.equalsEpsilon(pitch, -CesiumMath.PI_OVER_TWO, CesiumMath.EPSILON1);
    return {
      'background-color': this.nadirActive && isNadirPitch ? '#FFFFFF' : 'var(--ngm-interaction)',
    };
  }

  private toggleNadirStatus() {
    this.nadirActive = !this.nadirActive;
    this.dispatchEvent(new CustomEvent('nadirToggled'));
  }


  updateFromCamera() {
    if (!this.viewer) return;
    this.currentHeading = this.viewer.scene.camera.heading;
    if (this.nadirActive && !CesiumMath.equalsEpsilon(this.viewer.scene.camera.pitch, -CesiumMath.PI_OVER_TWO, CesiumMath.EPSILON1)) {
      this.height = undefined;
      this.toggleNadirStatus();
    }
    const angle = Math.round(this.currentHeading * 180 / Math.PI);
    if (this.northActive && !(angle === 0 || angle === 360)) {
        this.height = undefined;
        this.northActive = false;
    }
  }

  toggleNadir() {
    if (!this.viewer) return;
    const camera = this.viewer.scene.camera;

    if (this.nadirActive) {
      this.viewer.camera.setView({
        destination: this.position,
        orientation: {
          heading: camera.heading,
          pitch: this.pitch,
          roll: 0.0
        }
      });

      if (this.height !== undefined) {
        NavToolsStore.setCameraHeight(this.height);
      }
      this.height = undefined;
    } else {
      if (this.viewer.scene.cameraUnderground) {
        this.height = camera.positionCartographic.height;
        NavToolsStore.setCameraHeight(10000);
      }

      const targetPoint = getTargetParam();
      if (targetPoint) {
        this.position = Cartesian3.clone(camera.positionWC, new Cartesian3());
        updateHeightForCartesianPositions([targetPoint], camera.positionCartographic.height, undefined, true);
      }

      this.pitch = camera.pitch;
      if (!this.heading) this.heading = camera.heading;

      this.viewer.camera.setView({
        destination: targetPoint,
        orientation: {
          heading: camera.heading,
          pitch: CesiumMath.toRadians(-90),
          roll: 0.0
        }
      });

      this.toggleNadirStatus();
    }
  }

  toggleNorth() {
    if (!this.viewer) return;
    const camera = this.viewer.scene.camera;

    if (this.northActive) {
      this.viewer.camera.setView({
        destination: this.position,
        orientation: {
          heading: this.heading,
          pitch: camera.pitch,
          roll: 0.0
        }
      });

      if (this.height !== undefined) {
        NavToolsStore.setCameraHeight(this.height);
      }
      this.height = undefined;
    } else {
      if (this.viewer.scene.cameraUnderground) {
        this.height = camera.positionCartographic.height;
        NavToolsStore.setCameraHeight(10000);
      }

      if (!this.pitch) this.pitch = camera.pitch;
      this.heading = camera.heading;
      const targetPoint = getTargetParam();
      if (targetPoint) {
        this.position = Cartesian3.clone(camera.positionWC, new Cartesian3());
        updateHeightForCartesianPositions([targetPoint], camera.positionCartographic.height, undefined, true);
      }
      this.viewer.camera.setView({
        destination: targetPoint,
        orientation: {
          heading: 0,
          pitch: camera.pitch,
          roll: 0.0
        }
      });
    }

    this.northActive = !this.northActive;
  }

  render() {
    if (this.viewer) {
      return html`
        <div class="ngm-minimap-buttons">
          <div title="Activate nadir view" class="ngm-nadir" style=${styleMap(this.nadirCameraStyle)} @click=${this.toggleNadir}>
            <div class="ngm-nadir-camera-icon" style=${styleMap({backgroundColor: this.nadirActive ? 'var(--ngm-interaction)' : 'white'})}>
            </div>
          </div>
          <div title="Activate north-facing view" class="ngm-compass" style=${styleMap(this.compassStyle)} @click=${this.toggleNorth}>
            <div class="ngm-compass-arrow">
              <div class="ngm-compass-arrow-top"></div>
              <div class="ngm-compass-arrow-bottom"></div>
            </div>
          </div>
        </div>
      `;
    } else {
      return html``;
    }
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
