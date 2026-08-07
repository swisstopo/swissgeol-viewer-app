import { LitElementI18n } from '../i18n';
import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import draggable from './draggable';
import i18next from 'i18next';
import type { Interactable } from '@interactjs/types';
import {
  Cartesian2,
  Cartesian3,
  Ellipsoid,
  Event,
  KeyboardEventModifier,
  Math as CesiumMath,
  Matrix4,
  Scene,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
} from 'cesium';
import {
  formatCartographicAs2DLv95,
  lv95ToDegrees,
  radToDeg,
} from '../projection';
import { styleMap } from 'lit/directives/style-map.js';
import { classMap } from 'lit/directives/class-map.js';
import './ngm-cam-coordinates';
import NavToolsStore from '../store/navTools';
import { dragArea } from './helperElements';
import './ngm-minimap';
import { CoordinateWithCrs } from './ngm-cam-coordinates';
import { consume } from '@lit/context';
import { ControlsService } from 'src/features/controls/controls.service';
import { CameraControllerService } from 'src/features/controls/camera-controller.service';

export type LockType = '' | 'elevation' | 'angle' | 'pitch' | 'move';
export const ABSOLUTE_ELEVATION_MIN = 30000;
export const ABSOLUTE_ELEVATION_MAX = 700000;

/*
 * Convert cartographic height (between -30'000m and +300'000) to input value (between 0 and 1)
 * The input value between 0 to 0.5 is mapped to the height between -30'000m and 0m
 * The input between 0.5 and 1 is mapped to the height between 0m and +300'000m
 */
export function heightToValue(height: number): number {
  const m =
    0.5 / (height < 0 ? ABSOLUTE_ELEVATION_MIN : ABSOLUTE_ELEVATION_MAX);
  return m * height + 0.5;
}

/*
 * Convert input value (between 0 and 1) to cartographic height (between -30'000m and +300'000)
 * The input value between 0 to 0.5 is mapped to the height between -30'000m and 0m
 * The input between 0.5 and 1 is mapped to the height between 0m and +300'000m
 */
export function valueToHeight(value: number): number {
  if (value < 0.5) {
    return (ABSOLUTE_ELEVATION_MIN / 0.5) * value - ABSOLUTE_ELEVATION_MIN;
  } else {
    return (ABSOLUTE_ELEVATION_MAX / 0.5) * value - ABSOLUTE_ELEVATION_MAX;
  }
}

@customElement('ngm-cam-configuration')
export class NgmCamConfiguration extends LitElementI18n {
  @property({ type: Object })
  accessor viewer: Viewer | null = null;

  @consume({ context: ControlsService.context() })
  accessor controlsService!: ControlsService;

  @consume({ context: CameraControllerService.context() })
  accessor cameraControllerService!: CameraControllerService;

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

  @state()
  accessor is2DActive = false;

  // always use the 'de-CH' locale to always have the simple tick as thousands separator
  private readonly integerFormat = new Intl.NumberFormat('de-CH', {
    maximumFractionDigits: 1,
  });

  private timeout: null | NodeJS.Timeout = null;
  private handler: ScreenSpaceEventHandler | undefined;
  private lockMove = false;
  private readonly lockMoveStartPosition: Cartesian2 = new Cartesian2();
  private readonly lockMovePosition: Cartesian2 = new Cartesian2();
  private removeOnTick: Event.RemoveCallback | undefined;
  private readonly configurations = [
    {
      label: () =>
        html`${i18next.t('camera_position_height_label')}<br />${i18next.t(
            'camera_position_height_unit',
          )}`,
      iconClass: () =>
        classMap({
          'ngm-cam-h-icon': true,
          'ngm-active-icon': this.lockType === 'elevation',
        }),
      minValue: 0,
      maxValue: 1,
      step: 0.1 / (ABSOLUTE_ELEVATION_MAX + ABSOLUTE_ELEVATION_MIN),
      minInputValue: -ABSOLUTE_ELEVATION_MIN,
      maxInputValue: ABSOLUTE_ELEVATION_MAX,
      inputStep: 0.1,
      style: () => this.getSliderStyle(heightToValue(this.elevation), 0, 1),
      getValue: () => heightToValue(this.elevation),
      getInputValue: () => this.elevation.toFixed(1),
      getValueLabel: () => `${this.integerFormat.format(this.elevation)} m`,
      onSliderChange: (evt) =>
        this.updateHeight(valueToHeight(Number(evt.target.value))),
      onInputChange: (evt) => {
        if (this.timeout) {
          clearTimeout(this.timeout);
        }
        let value = Number(evt.target.value);
        if (value < -ABSOLUTE_ELEVATION_MIN) {
          value = -ABSOLUTE_ELEVATION_MIN;
        }
        if (value > ABSOLUTE_ELEVATION_MAX) {
          value = ABSOLUTE_ELEVATION_MAX;
        }
        this.timeout = setTimeout(() => {
          this.updateHeight(value);
          this.timeout = null;
        }, 300);
      },
      lock: () => this.toggleLock('elevation'),
      isDisabled: () => false,
    },
    {
      label: () => html`${i18next.t('camera_position_angle_label')}<br />(°)`,
      iconClass: () =>
        classMap({
          'ngm-cam-d-icon': true,
          'ngm-active-icon': this.lockType === 'angle',
        }),
      minValue: 0,
      maxValue: 359,
      step: 1,
      style: () => this.getSliderStyle(this.heading, 0, 359, true),
      getValue: () => this.heading,
      getValueLabel: () => `${this.integerFormat.format(this.heading)}°`,
      onSliderChange: (evt) => this.updateAngle(Number(evt.target.value)),
      lock: () => this.toggleLock('angle'),
      isDisabled: () => false,
    },
    {
      label: () => html`${i18next.t('camera_position_pitch_label')}<br />(°)`,
      iconClass: () =>
        classMap({
          'ngm-cam-t-icon': true,
          'ngm-active-icon': this.lockType === 'pitch',
        }),
      minValue: -90,
      maxValue: 90,
      step: 1,
      style: () => this.getSliderStyle(this.pitch, -90, 90),
      getValue: () => this.pitch,
      getValueLabel: () => `${this.integerFormat.format(this.pitch)}°`,
      onSliderChange: (evt) => this.updatePitch(Number(evt.target.value)),
      lock: () => this.toggleLock('pitch'),
      isDisabled: () => this.is2DActive,
    },
  ];

  connectedCallback() {
    draggable(this, {
      allowFrom: '.drag-handle',
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
    const { viewer } = this;
    if (viewer && !this.unlistenPostRender) {
      setTimeout(() => {
        this.scene = viewer.scene;
        this.handler = new ScreenSpaceEventHandler(viewer.canvas);
        this.unlistenPostRender = this.scene.postRender.addEventListener(() =>
          this.updateFromCamera(),
        );
        this.updateFromCamera();
      });
    }
    if (changedProperties.has('lockType'))
      NavToolsStore.setNavLockType(this.lockType);
    super.updated(changedProperties);
  }

  updateFromCamera() {
    const camera = this.scene!.camera;
    const pc = camera.positionCartographic;
    const altitude = this.scene!.globe.getHeight(pc) ?? 0;
    this.elevation = pc.height - altitude;

    this.pitch = Math.round(CesiumMath.toDegrees(camera.pitch));
    let heading = Math.round(CesiumMath.toDegrees(camera.heading));

    // hack to avoid angle numbers jumping
    if (this.pitch > 87 && heading > 0 && heading < 180) heading += 180;
    else if (this.pitch > 87 && heading >= 180) heading -= 180;
    this.heading = heading === 360 ? 0 : heading;
    this.coordinates = {
      lv95: formatCartographicAs2DLv95(pc),
      wgs84: [pc.longitude, pc.latitude].map(radToDeg),
    };
  }

  updateHeight(value: number) {
    const altitude =
      this.scene!.globe.getHeight(this.scene!.camera.positionCartographic) ?? 0;
    NavToolsStore.setCameraHeight(value + altitude);
  }

  updateAngle(value: number) {
    NavToolsStore.hideTargetPoint();
    this.scene!.camera.setView({
      orientation: {
        heading: CesiumMath.toRadians(value),
        pitch: CesiumMath.toRadians(this.pitch),
      },
    });
  }

  updatePitch(value: number) {
    if (this.controlsService.is2DActive) {
      return;
    }

    NavToolsStore.hideTargetPoint();
    this.scene!.camera.setView({
      orientation: {
        heading: CesiumMath.toRadians(this.heading),
        pitch: CesiumMath.toRadians(value),
      },
    });
  }

  updateCoordinates(event: CustomEvent<CoordinateWithCrs>) {
    const detail = event.detail;
    const coordinates =
      detail.crs === 'lv95'
        ? lv95ToDegrees([detail.long, detail.lat])
        : [detail.long, detail.lat];
    this.scene?.camera.setView({
      destination: Cartesian3.fromDegrees(
        coordinates[0],
        coordinates[1],
        Ellipsoid.WGS84.cartesianToCartographic(this.scene.camera.position)
          .height,
      ),
    });
  }

  getSliderStyle(
    value: number,
    minValue: number,
    maxValue: number,
    oneDirection = false,
  ) {
    if (oneDirection) {
      return {
        'background-image': `linear-gradient(to right, var(--ngm-interaction-active), var(--ngm-interaction-active) ${(value / maxValue) * 100}%, white ${(value / maxValue) * 100}%)`,
      };
    }
    const range = maxValue - minValue;
    const valuePercent = Math.round(((value - minValue) / range) * 100);

    const start = Math.min(50, valuePercent);
    const stop = Math.max(50, valuePercent);

    return {
      'background-image': `linear-gradient(to right, #fff ${start}%, var(--ngm-interaction-active) ${start}% ${stop}%, #fff ${stop}% 100%)`,
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
    if (this.controlsService.is2DActive && type === 'pitch') {
      return;
    }

    if (!this.scene) return;
    this.disableLock();
    this.lockType = type;

    // Disable camera controllers based on lock type
    if (this.lockType === 'move') {
      // Keep tilt/orbit controller, remove pan and zoom
      this.cameraControllerService.removeController(
        this.cameraControllerService.panController,
      );
      this.cameraControllerService.removeController(
        this.cameraControllerService.zoomController,
      );
      this.handler!.setInputAction(
        () => {
          this.viewer!.scene.camera.lookAtTransform(Matrix4.IDENTITY);
        },
        ScreenSpaceEventType.LEFT_DOWN,
        KeyboardEventModifier.CTRL,
      );
    } else {
      // Disable all controllers for elevation/pitch/angle locks
      this.cameraControllerService.enableInputs = false;
      this.handler!.setInputAction((movement) => {
        this.lockMove = true;
        Cartesian2.clone(movement.position, this.lockMoveStartPosition);
      }, ScreenSpaceEventType.LEFT_DOWN);

      this.handler!.setInputAction((movement) => {
        Cartesian2.clone(movement.endPosition, this.lockMovePosition);
      }, ScreenSpaceEventType.MOUSE_MOVE);

      this.handler!.setInputAction(() => {
        this.lockMove = false;
      }, ScreenSpaceEventType.LEFT_UP);

      this.removeOnTick = this.viewer!.clock.onTick.addEventListener(() =>
        this.onTick(),
      );
    }
  }

  disableLock() {
    this.lockType = '';
    // Re-enable all controllers
    this.cameraControllerService.enableInputs = true;
    this.cameraControllerService.addController(
      this.cameraControllerService.panController,
    );
    this.cameraControllerService.addController(
      this.cameraControllerService.zoomController,
    );
    this.cameraControllerService.addController(
      this.cameraControllerService.tiltController,
    );
    this.handler?.removeInputAction(ScreenSpaceEventType.LEFT_DOWN);
    this.handler?.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
    this.handler?.removeInputAction(ScreenSpaceEventType.LEFT_UP);
    this.handler?.removeInputAction(
      ScreenSpaceEventType.LEFT_DOWN,
      KeyboardEventModifier.CTRL,
    );
    this.removeOnTick && this.removeOnTick();
  }

  onTick() {
    if (this.lockMove) {
      const x =
        (this.lockMovePosition.x - this.lockMoveStartPosition.x) /
        this.viewer!.canvas.clientWidth;
      const y =
        -(this.lockMovePosition.y - this.lockMoveStartPosition.y) /
        this.viewer!.canvas.clientHeight;
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

  createRenderRoot() {
    // no shadow dom
    return this;
  }

  render() {
    return html`
      <div class="ngm-floating-window-header drag-handle">
        ${i18next.t('cam_configuration_header')}
        <div
          class="ngm-close-icon"
          @click=${() => this.dispatchEvent(new CustomEvent('close'))}
        ></div>
      </div>
      <div class="ngm-cam-container">
        <ngm-minimap .viewer=${this.viewer}></ngm-minimap>
        ${this.configurations.map(
          (c) =>
            html` <div>
              <div
                class=${c.iconClass()}
                title=${i18next.t('cam_lock')}
                ?aria-disabled="${c.isDisabled()}"
                @click=${c.lock}
              ></div>
              <div class="ngm-cam-conf-slider">
                <div>
                  <label>${c.label()}</label>
                  <input
                    type="number"
                    class="ngm-cam-conf-number-input ${classMap({
                      disabled: c.isDisabled(),
                    })}"
                    min="${c.minInputValue ?? c.minValue}"
                    max="${c.maxInputValue ?? c.maxValue}"
                    step="${c.inputStep ?? c.step}"
                    .value=${c.getInputValue ? c.getInputValue() : c.getValue()}
                    ?disabled="${c.isDisabled()}"
                    @input=${c.onInputChange
                      ? c.onInputChange
                      : c.onSliderChange}
                  />
                </div>
                <input
                  type="range"
                  class="ngm-slider ${classMap({ disabled: c.isDisabled() })}"
                  style=${styleMap(c.style())}
                  min=${c.minValue}
                  max=${c.maxValue}
                  step=${c.step}
                  .value=${c.getValue()}
                  ?disabled="${c.isDisabled()}"
                  @input=${c.onSliderChange}
                  @keydown="${(e) =>
                    (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
                    e.stopPropagation()}"
                />
              </div>
            </div>`,
        )}
        <div>
          <div
            class="ngm-cam-icon ${classMap({
              'ngm-active-icon': this.lockType === 'move',
            })}"
            @click=${() => this.toggleLock('move')}
          ></div>
          <ngm-cam-coordinates
            @coordinates-changed="${this.updateCoordinates}"
            .coordinates=${this.coordinates}
          ></ngm-cam-coordinates>
        </div>
      </div>
      ${dragArea}
    `;
  }
}
