import {LitElementI18n} from '../i18n';
import {customElement, property, state} from 'lit/decorators.js';
import {html} from 'lit';
import {Viewer} from 'cesium';
import {setCameraHeight} from '../cesiumutils';

@customElement('ngm-height-slider')
export class NgmHeightSlider extends LitElementI18n {
  @property({type: Object}) viewer: Viewer | null = null;
  @state() value = 2;
  @state() unlistenPostRender: any = null;

  updated() {
    if (this.viewer && !this.unlistenPostRender) {
      this.unlistenPostRender = this.viewer.scene.postRender.addEventListener(() => this.updateFromCamera());
    }
  }

  connectedCallback() {
    super.connectedCallback();
  }

  disconnectedCallback() {
    if (this.unlistenPostRender) {
      this.unlistenPostRender();
    }
    super.disconnectedCallback();
  }

  updateFromCamera() {
    const camera = this.viewer!.scene.camera;
    const altitude = this.viewer!.scene.globe.getHeight(camera.positionCartographic) || 0;
    const elevation = camera.positionCartographic.height - altitude;
    this.value = this.heightToValue(elevation)!;
  }

  updateCameraHeight(event: Event) {
    if (!this.viewer) return;
    const input = event.target as HTMLInputElement;
    const camera = this.viewer.scene.camera;
    const altitude = this.viewer.scene.globe.getHeight(camera.positionCartographic) || 0;
    let height = Math.round(this.valueToHeight(Number(input.value)));
    const snapDistance = 150; // snap to 0 from 150m/-150m
    if (height <= snapDistance && height >= -snapDistance) height = 0;
    height += altitude;
    setCameraHeight(camera, height);
  }

  heightToValue(height: number) {
    const height_km = height / 1000;
    if (height_km >= 300) return 3;
    else if (height_km > 0) return height_km / 300 + 2;
    else if (height_km >= -30) return 2 - -height_km / 30 * 2;
    else return 0;
  }

  valueToHeight(value: number) {
    if (value >= 2) {
      return 300000 * (value - 2);
    } else {
      return -30000 * (1 - value / 2);
    }
  }

  render() {
    return html`
      <input type="range" min="0" max="3" step=0.01
             .value=${this.value}
             @input=${this.updateCameraHeight}>

    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
