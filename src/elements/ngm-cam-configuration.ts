import {LitElementI18n} from '../i18n';
import {customElement, html, property, state} from 'lit-element';
import draggable from './draggable';
import i18next from 'i18next';
import {Interactable} from '@interactjs/types';
import {Event, Scene, Viewer} from 'cesium';
import CesiumMath from 'cesium/Source/Core/Math';
import {formatCartographicAs2DLv95} from '../projection';
import {setCameraHeight} from '../cesiumutils';

@customElement('ngm-cam-configuration')
export class NgmCamConfiguration extends LitElementI18n {
  @property({type: Object}) viewer: Viewer | null = null
  @state() scene: Scene | null = null
  @state() interaction: Interactable | null = null
  @state() unlistenPostRender: Event.RemoveCallback | null = null
  @state() heading = 0
  @state() elevation = 0
  @state() pitch = 0
  @state() coordinates: string[] = []
  // always use the 'de-CH' locale to always have the simple tick as thousands separator
  private integerFormat = new Intl.NumberFormat('de-CH', {
    maximumFractionDigits: 0
  });

  private configurations = [
    {
      labelTag: 'camera_position_height_label',
      iconClass: 'ngm-cam-h-icon',
      minValue: -30000,
      maxValue: 30000,
      step: 100,
      getValue: () => this.elevation,
      getValueLabel: () => `${this.integerFormat.format(this.elevation)} m`,
      onChange: this.updateHeight
    },
    {
      labelTag: 'camera_position_angle_label',
      iconClass: 'ngm-cam-d-icon',
      minValue: 1,
      maxValue: 360,
      step: 1,
      getValue: () => this.heading,
      getValueLabel: () => `${this.integerFormat.format(this.heading)}°`,
      onChange: this.updateAngle
    },
    {
      labelTag: 'camera_position_pitch_label',
      iconClass: 'ngm-cam-t-icon',
      minValue: -180,
      maxValue: 180,
      step: 1,
      getValue: () => this.pitch,
      getValueLabel: () => `${this.integerFormat.format(this.pitch)}°`,
      onChange: this.updatePitch
    },
  ]

  connectedCallback() {
    this.interaction = draggable(this, {
      allowFrom: '.ngm-drag-area'
    });
    super.connectedCallback();
  }

  disconnectedCallback() {
    if (this.unlistenPostRender) {
      this.unlistenPostRender();
    }
    super.disconnectedCallback();
  }

  updated() {
    if (this.viewer && !this.unlistenPostRender) {
      this.scene = this.viewer.scene;
      this.unlistenPostRender = this.scene.postRender.addEventListener(() => this.updateFromCamera());
    }
  }

  updateFromCamera() {
    const camera = this.scene!.camera;
    let altitude = this.scene!.globe.getHeight(camera.positionCartographic);
    altitude = altitude ? altitude : 0;
    this.elevation = camera.positionCartographic.height - altitude;
    this.heading = CesiumMath.toDegrees(camera.heading);
    this.pitch = CesiumMath.toDegrees(camera.pitch);
    this.coordinates = formatCartographicAs2DLv95(camera.positionCartographic);
  }

  updateHeight(evt) {
    setCameraHeight(this.scene!.camera, Number(evt.target.value));
  }

  updateAngle(evt) {
    this.scene!.camera.setView({
      orientation: {
        heading: CesiumMath.toRadians(Number(evt.target.value)),
        pitch: CesiumMath.toRadians(this.pitch)
      }
    });
  }

  updatePitch(evt) {
    this.scene!.camera.setView({
      orientation: {
        heading: CesiumMath.toRadians(this.heading),
        pitch: CesiumMath.toRadians(Number(evt.target.value))
      }
    });
  }

  render() {
    return html`
      <div class="ngm-floating-window-header">
        ${i18next.t('cam_configuration_header')}
        <div class="ngm-close-icon" @click=${() => this.dispatchEvent(new CustomEvent('close'))}></div>
      </div>
      <div class="ngm-cam-container">
        ${this.configurations.map(c => html`
          <div>
            <div class=${c.iconClass}></div>
            <div class="ngm-cam-conf-slider">
              <div>
                <label>${i18next.t(c.labelTag)}</label>
                <label>${c.getValueLabel()}</label>
              </div>
              <input type="range" min=${c.minValue} max=${c.maxValue} step=${c.step} value=${c.getValue()}
                     @input=${c.onChange}/>
            </div>
          </div>`)}
        <div>
          <div class="ngm-cam-icon"></div>
          <div class="ngm-cam-coord">
            <label>${i18next.t('camera_position_coordinates_label')}</label>
            <label>${this.coordinates[0]}, ${this.coordinates[1]}</label>
          </div>
        </div>
      </div>
      <div class="ngm-drag-area">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
