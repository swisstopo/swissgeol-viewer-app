import {LitElementI18n} from '../i18n';
import type {PropertyValues} from 'lit';
import {html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import draggable from './draggable';
import i18next from 'i18next';
import type {Interactable} from '@interactjs/types';
import type {Event, Scene, Viewer} from 'cesium';
import {
  Cartesian2,
  KeyboardEventModifier,
  Math as CesiumMath,
  Matrix4,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType
} from 'cesium';
import {formatCartographicAs2DLv95, radToDeg} from '../projection';
import {styleMap} from 'lit/directives/style-map.js';
import {classMap} from 'lit/directives/class-map.js';
import './ngm-cam-coordinates';
import NavToolsStore from '../store/navTools';
import {dragArea} from './helperElements';

export type LockType = '' | 'elevation' | 'angle' | 'pitch' | 'move';

/*
 * Convert cartographic height (between -30'000m and +300'000) to input value (between 0 and 1)
 * The input value between 0 to 0.5 is mapped to the height between -30'000m and 0m
 * The input between 0.5 and 1 is mapped to the height between 0m and +300'000m
 */
export function heightToValue(height: number): number {
  const m = 0.5 / (height < 0 ? 30000 : 300000);
  return m * height + 0.5;
}

/*
 * Convert input value (between 0 and 1) to cartographic height (between -30'000m and +300'000)
 * The input value between 0 to 0.5 is mapped to the height between -30'000m and 0m
 * The input between 0.5 and 1 is mapped to the height between 0m and +300'000m
 */
export function valueToHeight(value: number): number {
  if (value < 0.5) {
    return (30000 / 0.5) * value - 30000;
  } else {
    return (300000 / 0.5) * value - 300000;
  }
}

@customElement('ngm-cam-configuration')
export class NgmCamConfiguration extends LitElementI18n {
  @property({type: Object})
  accessor viewer: Viewer | null = null;
  @state()
  accessor scene: Scene | null = null;
  @state()
  accessor interaction: Interactable | null = null;
  @state()
  accessor unlistenPostRender: Event.RemoveCallback | null = null;
  @state()
  accessor heading = 0;
  @state()
  accessor elevation = 0;
  @state()
  accessor pitch = 0;
  @state()
  accessor coordinates: Record<string, (string | number)[]> | null = null;
  @state()
  accessor lockType: LockType = '';
  // always use the 'de-CH' locale to always have the simple tick as thousands separator
  private integerFormat = new Intl.NumberFormat('de-CH', {
    maximumFractionDigits: 1
  });
  private handler: ScreenSpaceEventHandler | undefined;
  private lockMove = false;
  private lockMoveStartPosition: Cartesian2 = new Cartesian2();
  private lockMovePosition: Cartesian2 = new Cartesian2();
  private removeOnTick: Event.RemoveCallback | undefined;
  private configurations = [
    {
      label: () => i18next.t('camera_position_height_label'),
      iconClass: () => classMap({'ngm-cam-h-icon': true, 'ngm-active-icon': this.lockType === 'elevation'}),
      minValue: 0,
      maxValue: 1,
      step: 'any',
      style: () => this.getSliderStyle(heightToValue(this.elevation), 0, 1),
      getValue: () => heightToValue(this.elevation),
      getValueLabel: () => `${this.integerFormat.format(this.elevation)} m`,
      onChange: evt => this.updateHeight(valueToHeight(Number(evt.target.value))),
      lock: () => this.toggleLock('elevation')
    },
    {
      label: () => i18next.t('camera_position_angle_label'),
      iconClass: () => classMap({'ngm-cam-d-icon': true, 'ngm-active-icon': this.lockType === 'angle'}),
      minValue: -179,
      maxValue: 180,
      step: 1,
      style: () => this.getSliderStyle(this.heading, -179, 180),
      getValue: () => this.heading,
      getValueLabel: () => `${this.integerFormat.format(this.heading)}°`,
      onChange: (evt) => this.updateAngle(Number(evt.target.value)),
      lock: () => this.toggleLock('angle')
    },
    {
      label: () => i18next.t('camera_position_pitch_label'),
      iconClass: () => classMap({'ngm-cam-t-icon': true, 'ngm-active-icon': this.lockType === 'pitch'}),
      minValue: -90,
      maxValue: 90,
      step: 1,
      style: () => this.getSliderStyle(this.pitch, -90, 90),
      getValue: () => this.pitch,
      getValueLabel: () => `${this.integerFormat.format(this.pitch)}°`,
      onChange: (evt) => this.updatePitch(Number(evt.target.value)),
      lock: () => this.toggleLock('pitch')
    },
  ];

  connectedCallback() {
    draggable(this, {
      allowFrom: '.drag-handle'
    });
    super.connectedCallback();
  }

  disconnectedCallback() {
    if (this.unlistenPostRender) {
      this.unlistenPostRender();
    }
    super.disconnectedCallback();
  }

  updated(changedProperties: PropertyValues) {
    if (this.viewer && !this.unlistenPostRender) {
      this.scene = this.viewer.scene;
      this.handler = new ScreenSpaceEventHandler(this.viewer!.canvas);
      this.unlistenPostRender = this.scene.postRender.addEventListener(() => this.updateFromCamera());
      this.updateFromCamera();
    }
    if (changedProperties.has('lockType'))
      NavToolsStore.setNavLockType(this.lockType);
    super.updated(changedProperties);
  }

  updateFromCamera() {
    const camera = this.scene!.camera;
    const pc = camera.positionCartographic;
    const altitude = this.scene!.globe.getHeight(pc) || 0;
    this.elevation = pc.height - altitude;
    this.pitch = CesiumMath.toDegrees(camera.pitch);
    const heading = CesiumMath.toDegrees(camera.heading);
    this.heading = heading > 180 ? heading - 360 : heading;
    this.coordinates = {
      lv95: formatCartographicAs2DLv95(pc),
      wgs84: [pc.longitude, pc.latitude].map(radToDeg)
    };
  }

  updateHeight(value: number) {
    const altitude = this.scene!.globe.getHeight(this.scene!.camera.positionCartographic) || 0;
    NavToolsStore.setCameraHeight(value + altitude);
  }

  updateAngle(value: number) {
    NavToolsStore.hideTargetPoint();
    this.scene!.camera.setView({
      orientation: {
        heading: CesiumMath.toRadians(value),
        pitch: CesiumMath.toRadians(this.pitch)
      }
    });
  }

  updatePitch(value: number) {
    NavToolsStore.hideTargetPoint();
    this.scene!.camera.setView({
      orientation: {
        heading: CesiumMath.toRadians(this.heading),
        pitch: CesiumMath.toRadians(value)
      }
    });
  }

  getSliderStyle(value: number, minValue: number, maxValue: number) {
    const range = maxValue - minValue;
    const valuePercent = Math.round((value - minValue) / range * 100);

    const start = Math.min(50, valuePercent);
    const stop = Math.max(50, valuePercent);

    return {
      'background-image': `linear-gradient(to right, #fff ${start}%, var(--ngm-interaction-active) ${start}% ${stop}%, #fff ${stop}% 100%)`
    };
  }

  toggleLock(type: LockType) {
    if (this.lockType === type) {
      this.disableLock();
    } else {
      this.enableLock(type);
    }
  }

  enableLock(type: LockType) {
    if (!this.scene) return;
    this.disableLock();
    this.lockType = type;
    const cameraController = this.scene.screenSpaceCameraController;
    cameraController.enableTranslate = false;
    cameraController.enableZoom = false;
    cameraController.enableTilt = false;
    cameraController.enableLook = false;

    if (this.lockType === 'move') {
      this.handler!.setInputAction(() => {
        this.viewer!.scene.camera.lookAtTransform(Matrix4.IDENTITY);
      }, ScreenSpaceEventType.LEFT_DOWN, KeyboardEventModifier.CTRL);
    } else {
      cameraController.enableRotate = false;
      this.handler!.setInputAction(movement => {
        this.lockMove = true;
        Cartesian2.clone(movement.position, this.lockMoveStartPosition);
      }, ScreenSpaceEventType.LEFT_DOWN);

      this.handler!.setInputAction(movement => {
        Cartesian2.clone(movement.endPosition, this.lockMovePosition);
      }, ScreenSpaceEventType.MOUSE_MOVE);

      this.handler!.setInputAction(() => {
        this.lockMove = false;
      }, ScreenSpaceEventType.LEFT_UP);

      this.removeOnTick = this.viewer!.clock.onTick.addEventListener(() => this.onTick());
    }
  }

  disableLock() {
    this.lockType = '';
    const cameraController = this.scene!.screenSpaceCameraController;
    cameraController.enableRotate = true;
    cameraController.enableTranslate = true;
    cameraController.enableZoom = true;
    cameraController.enableTilt = true;
    cameraController.enableLook = true;
    this.handler?.removeInputAction(ScreenSpaceEventType.LEFT_DOWN);
    this.handler?.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
    this.handler?.removeInputAction(ScreenSpaceEventType.LEFT_UP);
    this.handler?.removeInputAction(ScreenSpaceEventType.LEFT_DOWN, KeyboardEventModifier.CTRL);
    this.removeOnTick && this.removeOnTick();
  }

  onTick() {
    if (this.lockMove) {
      const x = (this.lockMovePosition.x - this.lockMoveStartPosition.x) / this.viewer!.canvas.clientWidth;
      const y = -(this.lockMovePosition.y - this.lockMoveStartPosition.y) / this.viewer!.canvas.clientHeight;
      const moveFactor = 1000;
      switch (this.lockType) {
        case 'elevation':
          this.updateHeight(this.elevation + y * moveFactor);
          break;
        case 'angle':
          this.updateAngle(this.heading + x);
          break;
        case 'pitch':
          this.updatePitch(this.pitch + y);
          break;
        default:
          throw new Error('Incorrect lock type');
      }
    }
  }


  render() {
    return html`
      <div class="ngm-floating-window-header drag-handle">
        ${i18next.t('cam_configuration_header')}
        <div class="ngm-close-icon" @click=${() => this.dispatchEvent(new CustomEvent('close'))}></div>
      </div>
      <div class="ngm-cam-container">
        ${this.configurations.map(c => html`
          <div>
            <div class=${c.iconClass()} title=${i18next.t('cam_lock')} @click=${c.lock}></div>
            <div class="ngm-cam-conf-slider">
              <div>
                <label>${c.label()}</label>
                <label>${c.getValueLabel()}</label>
              </div>
              <input type="range" class="ngm-slider" style=${styleMap(c.style())}
                     min=${c.minValue}
                     max=${c.maxValue}
                     step=${c.step}
                     .value=${c.getValue()}
                     @input=${c.onChange}/>
            </div>
          </div>`)}
        <div>
          <div class="ngm-cam-icon ${classMap({'ngm-active-icon': this.lockType === 'move'})}"
               @click=${() => this.toggleLock('move')}></div>
          <ngm-cam-coordinates .coordinates=${this.coordinates}></ngm-cam-coordinates>
        </div>
      </div>
      ${dragArea}
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
