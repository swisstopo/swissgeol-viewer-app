import {customElement, property, state} from 'lit/decorators.js';
import {html} from 'lit';

import {LitElementI18n} from '../i18n.js';
import {updateHeightForCartesianPositions} from '../cesiumutils';

import {Math as CesiumMath, Cartesian3} from 'cesium';
import {styleMap} from 'lit/directives/style-map.js';
import type {Event, Viewer} from 'cesium';
import {getTargetParam} from '../permalink';
import NavToolsStore from '../store/navTools';

@customElement('ngm-nadir-view')
export class NgmNadirView extends LitElementI18n {
  @property({type: Object}) viewer: Viewer | null = null;
  @state() unlistenPostRender: Event.RemoveCallback | null = null;
  @state() active = false;
  @state() pitch: number | undefined = undefined;
  @state() height: number | undefined = undefined;
  @state() heading: number | undefined = undefined;
  @state() position: Cartesian3 | undefined = undefined;
  @state() currentHeading = 0;

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
      'background-color': this.active && (angle === 0 || angle === 360) ? '#FFFFFF' : 'var(--ngm-interaction)',
    };
  }


  updateFromCamera() {
    if (!this.viewer) return;
    this.currentHeading = this.viewer.scene.camera.heading;
    if (this.active && !CesiumMath.equalsEpsilon(this.viewer.scene.camera.pitch, -CesiumMath.PI_OVER_TWO, CesiumMath.EPSILON1)) {
      this.pitch = undefined;
      this.height = undefined;
      this.heading = undefined;
      this.active = false;
    }
  }

  toggle() {
    if (!this.viewer) return;
    const camera = this.viewer.scene.camera;

    if (this.active) {
      this.viewer.camera.setView({
        destination: this.position,
        orientation: {
          heading: this.heading,
          pitch: this.pitch,
          roll: 0.0
        }
      });
      this.heading = undefined;
      this.pitch = undefined;
      this.position = undefined;

      if (this.height !== undefined) {
        NavToolsStore.setCameraHeight(this.height);
      }
      this.height = undefined;
    } else {
      if (this.viewer.scene.cameraUnderground) {
        this.height = camera.positionCartographic.height;
        NavToolsStore.setCameraHeight(10000);
      }

      this.pitch = camera.pitch;
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
          pitch: CesiumMath.toRadians(-90),
          roll: 0.0
        }
      });
    }

    this.active = !this.active;
  }

  render() {
    if (this.viewer) {
      return html`
        <div class="ngm-compass" style=${styleMap(this.compassStyle)} @click=${this.toggle}>
          <div class="ngm-compass-arrow">
            <div class="ngm-compass-arrow-top"></div>
            <div class="ngm-compass-arrow-bottom"></div>
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
