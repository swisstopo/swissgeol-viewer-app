import {customElement, html, property, state} from 'lit-element';
import {LitElementI18n} from '../i18n.js';
import {setCameraHeight} from '../cesiumutils.js';

import CesiumMath from 'cesium/Source/Core/Math';
import {styleMap} from 'lit-html/directives/style-map';
import {Event, Viewer} from 'cesium';

@customElement('ngm-nadir-view')
export class NgmNadirView extends LitElementI18n {
  @property({type: Object}) viewer: Viewer | null = null;
  @state() unlistenPostRender: Event.RemoveCallback | null = null;
  @state() active = false;
  @state() pitch: number | undefined = undefined;
  @state() height: number | undefined = undefined;
  @state() heading: number | undefined = undefined;
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
    const angle = this.currentHeading * 180 / Math.PI;
    return {
      'background-color': this.active && (angle === 0 || angle === 360) ? '#FFFFFF' : '#0B7285',
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
        orientation: {
          heading: this.heading,
          pitch: this.pitch,
          roll: 0.0
        }
      });
      this.heading = undefined;
      this.pitch = undefined;

      if (this.height !== undefined) {
        setCameraHeight(camera, this.height);
      }
      this.height = undefined;
    } else {
      if (this.viewer.scene.cameraUnderground) {
        this.height = camera.positionCartographic.height;
        setCameraHeight(camera, 10000);
      }

      this.pitch = camera.pitch;
      this.heading = camera.heading;
      this.viewer.camera.setView({
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
