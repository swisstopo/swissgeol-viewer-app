import {LitElementI18n} from '../i18n';
import {customElement, property, state} from 'lit/decorators.js';
import {html} from 'lit';
import type {Viewer} from 'cesium';
import NavToolsStore from '../store/navTools';

/*
 * Convert cartographic height (between -30'000m and +300'000) to input value (between 0 and 3)
 * The input value between 0 and 1.35 is mapped to the height between -30'000m and 0m
 * The input value between 1.35 and 2.7 is mapped to the height between 0m and +30'000m
 * The input value between 2.7 and 3 is mapped to the height between +30'000m and +300'000m
 */
export function heightToValue(height: number): number {
  if (height < 30000) {
    return (1.35 / 30000) * height + 1.35;
  } else {
    return (0.3 / 270000) * height + 2.65;
  }
}

/*
 * Convert input value (between 0 and 3) to cartographic height (between -30'000m and +300'000)
 * The input value between 0 and 1.35 is mapped to the height between -30'000m and 0m
 * The input value between 1.35 and 2.7 is mapped to the height between 0m and +30'000m
 * The input value between 2.7 and 3 is mapped to the height between +30'000m and +300'000m
 */
export function valueToHeight(value: number): number {
  if (value < 2.7) {
    return (30000 / 1.35) * value - 30000;
  } else {
    return (270000 / 0.3) * value - 2400000;
  }
}


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
    this.value = heightToValue(elevation)!;
  }

  updateCameraHeight(event: Event) {
    if (!this.viewer) return;
    const input = event.target as HTMLInputElement;
    const camera = this.viewer.scene.camera;
    const altitude = this.viewer.scene.globe.getHeight(camera.positionCartographic) || 0;
    let height = Math.round(valueToHeight(Number(input.value)));
    const snapDistance = 800; // snap to 0 from 800/-800m
    if (height <= snapDistance && height >= -snapDistance) height = 10;
    height += altitude;
    NavToolsStore.setCameraHeight(height);
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
