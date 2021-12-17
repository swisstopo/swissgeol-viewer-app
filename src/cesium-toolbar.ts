import {css, html, LitElement} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import MainStore from './store/main';
import type {Viewer} from 'cesium';
import {Cartesian4, Color} from 'cesium';

@customElement('cesium-toolbar')
export class CesiumToolbar extends LitElement {
  private viewer: Viewer | undefined | null;
  @state() show = true;
  @state() ambientOcclusionOnly = false;
  @state() intensity = 3.0;
  @state() bias = 0.1;
  @state() lengthCap = 0.03;
  @state() stepSize = 1.0;
  @state() blurStepSize = 0.86;
  @state() fogX = 10000;
  @state() fogY = 0;
  @state() fogZ = 150000;
  @state() fogIntensity = 0.3;
  @state() fogColor = '#000';
  @state() undergroundColor = '#000';
  @state() backgroundColor = '#000';

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
  }

  protected updated(_changedProperties) {
    if (this.viewer) {
      const ambientOcclusion =
        this.viewer!.scene.postProcessStages.ambientOcclusion;
      ambientOcclusion.enabled =
        Boolean(this.show) || Boolean(this.ambientOcclusionOnly);
      ambientOcclusion.uniforms.ambientOcclusionOnly = Boolean(
        this.ambientOcclusionOnly
      );
      ambientOcclusion.uniforms.intensity = Number(this.intensity);
      ambientOcclusion.uniforms.bias = Number(this.bias);
      ambientOcclusion.uniforms.lengthCap = Number(this.lengthCap);
      ambientOcclusion.uniforms.stepSize = Number(this.stepSize);
      ambientOcclusion.uniforms.blurStepSize = Number(
        this.blurStepSize
      );

      const fog = this.viewer!.scene.postProcessStages.get(0);
      fog.uniforms.fogByDistance = new Cartesian4(this.fogX, this.fogY, this.fogZ, this.fogIntensity);
      fog.uniforms.fogColor = Color.fromCssColorString(this.fogColor);

      this.viewer.scene.globe.undergroundColor = Color.fromCssColorString(this.undergroundColor);
      this.viewer.scene.backgroundColor = Color.fromCssColorString(this.backgroundColor);

      this.viewer!.scene.requestRender();
    }
    super.updated(_changedProperties);
  }

  static styles = css`
    :host {
      position: absolute;
      background-color: #0000005c;
      color: white;
      margin-left: 5px;
      padding: 5px;
    }

    input[type=number] {
      width: 80px;
    }

    .divider {
      width: 100%;
      border: 1px solid #E0E3E6;
      margin: 5px 0;
    }
  `;

  render() {
    return html`
      <div>
        Ambient Occlusion
        <input type="checkbox" ?checked=${this.show} @change=${event => this.show = event.target.checked}>
      </div>
      <div>
        Ambient Occlusion Only
        <input type="checkbox" ?checked=${this.ambientOcclusionOnly}
               @change=${event => this.ambientOcclusionOnly = event.target.checked}>
      </div>
      <div>
        Intensity
        <input type="range" min="1" max="10" step="1" .value=${this.intensity}
               @input=${evt => this.intensity = Number(evt.target.value)}>
      </div>
      <div>
        Length Cap
        <input type="range" min="0" max="1" step="0.01" .value=${this.lengthCap}
               @input=${evt => this.lengthCap = Number(evt.target.value)}>
      </div>
      <div>
        Step Size
        <input type="range" min="1" max="10" step="0.01" .value=${this.stepSize}
               @input=${evt => this.stepSize = Number(evt.target.value)}></div>
      <div>
        Bias
        <input type="range" min="0" max="1" step="0.01" .value=${this.bias}
               @input=${evt => this.bias = Number(evt.target.value)}></div>
      <div>
        Blur Step Size
        <input type="range" min="0" max="4" step="0.01" .value=${this.blurStepSize}
               @input=${evt => this.blurStepSize = Number(evt.target.value)}>
      </div>
      <div class="divider"></div>
      <div>
        Fog X Direction
        <input type="range" min="0" max="1000000" step="1" .value=${this.fogX}
               @input=${evt => this.fogX = Number(evt.target.value)}>
        <input type="number" min="0" max="1000000" step="1" .value=${this.fogX}
               @input=${evt => this.fogX = Number(evt.target.value)}>
      </div>
      <div>
        Fog Y Direction
        <input type="range" min="0" max="1000000" step="1" .value=${this.fogY}
               @input=${evt => this.fogY = Number(evt.target.value)}>
        <input type="number" min="0" max="1000000" step="1" .value=${this.fogY}
               @input=${evt => this.fogY = Number(evt.target.value)}>
      </div>
      <div>
        Fog Z Direction
        <input type="range" min="0" max="1000000" step="1" .value=${this.fogZ}
               @input=${evt => this.fogZ = Number(evt.target.value)}>
        <input type="number" min="0" max="1000000" step="1" .value=${this.fogZ}
               @input=${evt => this.fogZ = Number(evt.target.value)}>
      </div>
      <div>
        Fog Opacity
        <input type="range" min="0" max="1" step="0.1" .value=${this.fogIntensity}
               @input=${evt => this.fogIntensity = Number(evt.target.value)}>
      </div>
      <div>
        Fog Color
        <input type="color" .value=${this.fogColor} @input=${evt => this.fogColor = evt.target.value}>
      </div>
      <div class="divider"></div>
      <div>
        Underground Color
        <input type="color" .value=${this.undergroundColor} @input=${evt => this.undergroundColor = evt.target.value}>
      </div>
      <div class="divider"></div>
      <div>
        Background Color
        <input type="color" .value=${this.backgroundColor} @input=${evt => this.backgroundColor = evt.target.value}>
      </div>`;
  }
}
