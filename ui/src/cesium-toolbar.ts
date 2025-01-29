import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import MainStore from './store/main';
import type { Event, Viewer } from 'cesium';
import { Cartesian4, Color, FrameRateMonitor, ShadowMode } from 'cesium';

@customElement('cesium-toolbar')
export class CesiumToolbar extends LitElement {
  private viewer: Viewer | undefined | null;
  private frameRateMonitor: FrameRateMonitor | undefined;
  private scaleListenerRemove: Event.RemoveCallback | undefined;
  @state()
  accessor show = true;
  @state()
  accessor ambientOcclusionOnly = false;
  @state()
  accessor intensity = 3.0;
  @state()
  accessor bias = 0.1;
  @state()
  accessor lengthCap = 0.03;
  @state()
  accessor stepSize = 1.0;
  @state()
  accessor blurStepSize = 0.86;
  @state()
  accessor fogX = 10000;
  @state()
  accessor fogY = 0;
  @state()
  accessor fogZ = 150000;
  @state()
  accessor fogIntensity = 0.3;
  @state()
  accessor fogColor = '#000';
  @state()
  accessor undergroundColor = '#000';
  @state()
  accessor undergroundColorAlpha = 0.5;
  @state()
  accessor backgroundColor = '#000';
  @state()
  accessor autoScale = false;
  @state()
  accessor currentScale = 1;
  @state()
  accessor scaleDownFps = 20;
  @state()
  accessor scaleUpFps = 40;
  @state()
  accessor showFramesPerSecond = false;
  @state()
  accessor lightIntensity = 1.0;
  @state()
  accessor atmosphereLightIntensity = 10;
  @state()
  accessor shadowEnabled = true;
  @state()
  accessor shadowFadingEnabled = true;
  @state()
  accessor shadowNormalOffset = true;
  @state()
  accessor softShadows = false;
  @state()
  accessor shadowDarkness = 0.3;
  @state()
  accessor shadowMaximumDistance = 5000;
  @state()
  accessor terrainShadowMode: ShadowMode = ShadowMode.ENABLED;

  constructor() {
    super();
    MainStore.viewer.subscribe((viewer) => {
      this.viewer = viewer;
      if (viewer)
        this.frameRateMonitor = FrameRateMonitor.fromScene(viewer.scene);
    });
  }

  protected updated(changedProperties) {
    if (this.viewer) {
      const ambientOcclusion =
        this.viewer!.scene.postProcessStages.ambientOcclusion;
      ambientOcclusion.enabled =
        Boolean(this.show) || Boolean(this.ambientOcclusionOnly);
      ambientOcclusion.uniforms.ambientOcclusionOnly = Boolean(
        this.ambientOcclusionOnly,
      );
      ambientOcclusion.uniforms.intensity = Number(this.intensity);
      ambientOcclusion.uniforms.bias = Number(this.bias);
      ambientOcclusion.uniforms.lengthCap = Number(this.lengthCap);
      ambientOcclusion.uniforms.stepSize = Number(this.stepSize);
      ambientOcclusion.uniforms.blurStepSize = Number(this.blurStepSize);

      const fog = this.viewer!.scene.postProcessStages.get(0);
      fog.uniforms.fogByDistance = new Cartesian4(
        this.fogX,
        this.fogY,
        this.fogZ,
        this.fogIntensity,
      );
      fog.uniforms.fogColor = Color.fromCssColorString(this.fogColor);

      this.viewer.scene.globe.undergroundColor = Color.fromCssColorString(
        this.undergroundColor,
      ).withAlpha(this.undergroundColorAlpha);
      this.viewer.scene.backgroundColor = Color.fromCssColorString(
        this.backgroundColor,
      );

      this.viewer.scene.atmosphere.lightIntensity =
        this.atmosphereLightIntensity;

      this.showFramesPerSecond = this.viewer.scene.debugShowFramesPerSecond;

      this.viewer.scene.light.intensity = this.lightIntensity;

      this.viewer.shadows = this.shadowEnabled;
      this.viewer.shadowMap.maximumDistance = this.shadowMaximumDistance;
      this.viewer.shadowMap.softShadows = this.softShadows;
      this.viewer.shadowMap.normalOffset = this.shadowNormalOffset;
      this.viewer.shadowMap.maximumDistance = this.shadowMaximumDistance;
      this.viewer.shadowMap.darkness = this.shadowDarkness;
      this.viewer.terrainShadows = this.terrainShadowMode;

      this.viewer!.scene.requestRender();
    }
    if (changedProperties.has('autoScale') && this.viewer) {
      if (this.autoScale) {
        this.currentScale = this.viewer!.resolutionScale;
        this.scaleListenerRemove =
          this.viewer.scene.postRender.addEventListener(() => {
            if (
              this.frameRateMonitor!.lastFramesPerSecond < this.scaleDownFps &&
              this.viewer!.resolutionScale > 0.45
            ) {
              this.viewer!.resolutionScale = Number(
                (this.viewer!.resolutionScale - 0.05).toFixed(2),
              );
              this.currentScale = this.viewer!.resolutionScale;
            } else if (
              this.frameRateMonitor!.lastFramesPerSecond > this.scaleUpFps &&
              this.viewer!.resolutionScale < 1
            ) {
              this.viewer!.resolutionScale = Number(
                (this.viewer!.resolutionScale + 0.05).toFixed(2),
              );
              this.currentScale = this.viewer!.resolutionScale;
            }
          });
      } else if (this.scaleListenerRemove) {
        this.scaleListenerRemove();
      }
    }
    super.updated(changedProperties);
  }

  render() {
    return html` <div>
        Ambient Occlusion
        <input
          type="checkbox"
          ?checked=${this.show}
          @change=${(event) => (this.show = event.target.checked)}
        />
      </div>
      <div>
        Ambient Occlusion Only
        <input
          type="checkbox"
          ?checked=${this.ambientOcclusionOnly}
          @change=${(event) =>
            (this.ambientOcclusionOnly = event.target.checked)}
        />
      </div>
      <div>
        Intensity
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          .value=${this.intensity}
          @input=${(evt) => (this.intensity = Number(evt.target.value))}
        />
      </div>
      <div>
        Length Cap
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          .value=${this.lengthCap}
          @input=${(evt) => (this.lengthCap = Number(evt.target.value))}
        />
      </div>
      <div>
        Step Size
        <input
          type="range"
          min="1"
          max="10"
          step="0.01"
          .value=${this.stepSize}
          @input=${(evt) => (this.stepSize = Number(evt.target.value))}
        />
      </div>
      <div>
        Bias
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          .value=${this.bias}
          @input=${(evt) => (this.bias = Number(evt.target.value))}
        />
      </div>
      <div>
        Blur Step Size
        <input
          type="range"
          min="0"
          max="4"
          step="0.01"
          .value=${this.blurStepSize}
          @input=${(evt) => (this.blurStepSize = Number(evt.target.value))}
        />
      </div>
      <div class="divider"></div>
      <div>
        Light Intensity
        <input
          type="range"
          min="1"
          max="50000"
          step="1"
          .value=${this.lightIntensity}
          @input=${(evt) => (this.lightIntensity = Number(evt.target.value))}
        />
        <input
          type="number"
          min="0"
          max="50000"
          step="1"
          .value=${this.lightIntensity}
          @input=${(evt) => (this.lightIntensity = Number(evt.target.value))}
        />
      </div>
      <div class="divider"></div>
      <div>
        Atmosphere Light Intensity
        <input
          type="range"
          min="1"
          max="50"
          step="1"
          .value=${this.atmosphereLightIntensity}
          @input=${(evt) =>
            (this.atmosphereLightIntensity = Number(evt.target.value))}
        />
        <input
          type="number"
          min="0"
          max="50"
          step="1"
          .value=${this.atmosphereLightIntensity}
          @input=${(evt) =>
            (this.atmosphereLightIntensity = Number(evt.target.value))}
        />
      </div>
      <div class="divider"></div>
      <div>
        Fog X Direction
        <input
          type="range"
          min="0"
          max="1000000"
          step="1"
          .value=${this.fogX}
          @input=${(evt) => (this.fogX = Number(evt.target.value))}
        />
        <input
          type="number"
          min="0"
          max="1000000"
          step="1"
          .value=${this.fogX}
          @input=${(evt) => (this.fogX = Number(evt.target.value))}
        />
      </div>
      <div>
        Fog Y Direction
        <input
          type="range"
          min="0"
          max="1000000"
          step="1"
          .value=${this.fogY}
          @input=${(evt) => (this.fogY = Number(evt.target.value))}
        />
        <input
          type="number"
          min="0"
          max="1000000"
          step="1"
          .value=${this.fogY}
          @input=${(evt) => (this.fogY = Number(evt.target.value))}
        />
      </div>
      <div>
        Fog Z Direction
        <input
          type="range"
          min="0"
          max="1000000"
          step="1"
          .value=${this.fogZ}
          @input=${(evt) => (this.fogZ = Number(evt.target.value))}
        />
        <input
          type="number"
          min="0"
          max="1000000"
          step="1"
          .value=${this.fogZ}
          @input=${(evt) => (this.fogZ = Number(evt.target.value))}
        />
      </div>
      <div>
        Fog Opacity
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          .value=${this.fogIntensity}
          @input=${(evt) => (this.fogIntensity = Number(evt.target.value))}
        />
      </div>
      <div>
        Fog Color
        <input
          type="color"
          .value=${this.fogColor}
          @input=${(evt) => (this.fogColor = evt.target.value)}
        />
      </div>
      <div class="divider"></div>
      <div>
        Underground Color
        <input
          type="color"
          .value=${this.undergroundColor}
          @input=${(evt) => (this.undergroundColor = evt.target.value)}
        />
      </div>
      <div>
        Underground Color Alpha
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          .value=${this.undergroundColorAlpha}
          @input=${(evt) =>
            (this.undergroundColorAlpha = Number(evt.target.value))}
        />
      </div>
      <div class="divider"></div>
      <div>
        Background Color
        <input
          type="color"
          .value=${this.backgroundColor}
          @input=${(evt) => (this.backgroundColor = evt.target.value)}
        />
      </div>
      <div class="divider"></div>
      <div>
        Show FPS
        <input
          type="checkbox"
          ?checked=${this.showFramesPerSecond}
          @change=${(event) =>
            (this.viewer!.scene.debugShowFramesPerSecond =
              event.target.checked)}
        />
      </div>
      <div>
        Auto resolution scale
        <input
          type="checkbox"
          ?checked=${this.autoScale}
          @change=${(event) => (this.autoScale = event.target.checked)}
        />
        <span>Current scale: ${this.currentScale}</span>
      </div>
      <div .hidden="${!this.autoScale}">
        Scale down if FPS less then
        <input
          type="number"
          min="0"
          max="500"
          step="1"
          .value=${this.scaleDownFps}
          @input=${(evt) => (this.scaleDownFps = Number(evt.target.value))}
        />
      </div>
      <div .hidden="${!this.autoScale}">
        Scale up if FPS more then
        <input
          type="number"
          min="0"
          max="500"
          step="1"
          .value=${this.scaleUpFps}
          @input=${(evt) => (this.scaleUpFps = Number(evt.target.value))}
        />
      </div>
      <div .hidden="${this.autoScale}">
        Resolution scale
        <input
          type="range"
          min="0.05"
          max="1"
          step="0.05"
          .value=${this.currentScale}
          @input=${(evt) => {
            this.viewer!.resolutionScale = Number(evt.target.value);
            this.currentScale = this.viewer!.resolutionScale;
          }}
        />
      </div>
      <div class="divider"></div>
      <div>
        Enable shadows
        <input
          type="checkbox"
          ?checked=${this.shadowEnabled}
          @change=${(event) => (this.shadowEnabled = event.target.checked)}
        />
      </div>
      <div>
        Shadow Normal Offset
        <input
          type="checkbox"
          ?checked=${this.shadowNormalOffset}
          @change=${(event) => (this.shadowNormalOffset = event.target.checked)}
        />
      </div>
      <div>
        Enable soft shadows
        <input
          type="checkbox"
          ?checked=${this.softShadows}
          @change=${(event) => (this.softShadows = event.target.checked)}
        />
      </div>
      <div>
        Enable shadows fading
        <input
          type="checkbox"
          ?checked=${this.shadowFadingEnabled}
          @change=${(event) =>
            (this.shadowFadingEnabled = event.target.checked)}
        />
      </div>
      <div>
        Shadow darkness
        <input
          type="range"
          min="0.05"
          max="1"
          step="0.05"
          .value=${this.shadowDarkness}
          @input=${(evt) => {
            this.shadowDarkness = Number(evt.target.value);
          }}
        />
      </div>
      <div>
        Shadow maximum distance
        <input
          type="range"
          min="0.05"
          max="100000"
          step="100"
          .value=${this.shadowMaximumDistance}
          @input=${(evt) => {
            this.shadowMaximumDistance = Number(evt.target.value);
          }}
        />
      </div>
      <div>
        Terrain Shadows Mode
        <select
          @change=${(e) => (this.terrainShadowMode = Number(e.target.value))}
        >
          <option .value=${ShadowMode.ENABLED}>ENABLED</option>
          <option .value=${ShadowMode.DISABLED}>DISABLED</option>
          <option .value=${ShadowMode.CAST_ONLY}>CAST_ONLY</option>
          <option .value=${ShadowMode.RECEIVE_ONLY}>RECEIVE_ONLY</option>
        </select>
      </div>`;
  }
  static readonly styles = css`
    :host {
      position: absolute;
      background-color: #0000005c;
      color: white;
      margin-left: 5px;
      padding: 5px;
    }

    input[type='number'] {
      width: 80px;
    }

    .divider {
      width: 100%;
      border: 1px solid #e0e3e6;
      margin: 5px 0;
    }
  `;
}
