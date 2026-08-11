import { BaseService } from 'src/services/base.service';
import { CesiumService } from 'src/services/cesium.service';
import {
  Cartesian3,
  Cartesian4,
  Event,
  Matrix4,
  Scene,
  Transforms,
  Viewer,
} from 'cesium';
import { firstValueFrom } from 'rxjs';
import NavToolsStore from 'src/store/navTools';

const MIN_CAMERA_SPEED = 0.0;
const MAX_CAMERA_SPEED = 2000.0;
const BASE_CAMERA_SPEED_STEP = 75.0;
const DEFAULT_CAMERA_SPEED = 800.0;

interface MovementFlags {
  moveForward: boolean;
  moveBackward: boolean;
  moveUp: boolean;
  moveDown: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  lookUp: boolean;
  lookDown: boolean;
  lookLeft: boolean;
  lookRight: boolean;
}

/**
 * Keyboard-based camera navigation using WASD/QE keys.
 * Uses ENU (East-North-Up) frame for vertical movement so "up" always means
 * away from the globe surface regardless of camera orientation.
 *
 * Speed is adjustable via Shift+scroll wheel.
 */
export class KeyboardNavigationService extends BaseService {
  private scene!: Scene;
  private canvas: HTMLCanvasElement | undefined;
  private cameraSpeed = DEFAULT_CAMERA_SPEED;
  private unlistenPostRender: Event.RemoveCallback | null = null;

  private readonly flags: MovementFlags = {
    moveForward: false,
    moveBackward: false,
    moveUp: false,
    moveDown: false,
    moveLeft: false,
    moveRight: false,
    lookUp: false,
    lookDown: false,
    lookLeft: false,
    lookRight: false,
  };

  private readonly rotateSpeed = Math.PI / 400;

  private readonly keyDownHandler = this.onKeyDown.bind(this);
  private readonly keyUpHandler = this.onKeyUp.bind(this);
  private readonly blurHandler = this.resetFlags.bind(this);
  private readonly wheelHandler = this.onWheel.bind(this);

  constructor() {
    super();

    BaseService.onReady(() => void this.setup());
  }

  private async setup(): Promise<void> {
    const cesiumService = await CesiumService.inject();
    const viewer = await firstValueFrom(cesiumService.viewer$);
    this.initialize(viewer);
  }

  get speed(): number {
    return this.cameraSpeed;
  }

  set speed(value: number) {
    this.cameraSpeed = clamp(value, MIN_CAMERA_SPEED, MAX_CAMERA_SPEED);
  }

  private initialize(viewer: Viewer): void {
    this.scene = viewer.scene;

    const canvas = this.scene.canvas;
    this.canvas = canvas;
    canvas.setAttribute('tabindex', '0');
    canvas.onclick = () => canvas.focus();

    document.addEventListener('keydown', this.keyDownHandler);
    document.addEventListener('keyup', this.keyUpHandler);
    window.addEventListener('blur', this.blurHandler);
    canvas.addEventListener('wheel', this.wheelHandler, {
      passive: false,
      capture: true,
    });

    this.unlistenPostRender = this.scene.postRender.addEventListener(() =>
      this.onPostRender(),
    );
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!isTargetNavigable(event.target as HTMLElement)) {
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      return;
    }

    const flag = getFlagForKey(event.key.toLowerCase());
    if (flag !== undefined) {
      this.flags[flag] = true;
      NavToolsStore.hideTargetPoint();
      event.preventDefault();
      this.scene.requestRender();
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    const flag = getFlagForKey(event.key.toLowerCase());
    if (flag !== undefined) {
      this.flags[flag] = false;
    }
  }

  private resetFlags(): void {
    for (const key of Object.keys(this.flags) as (keyof MovementFlags)[]) {
      this.flags[key] = false;
    }
  }

  private onWheel(event: WheelEvent): void {
    if (!event.shiftKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const direction = Math.sign(event.deltaY);
    if (direction === 0) {
      return;
    }
    this.cameraSpeed = clamp(
      this.cameraSpeed - direction * wheelStep(this.cameraSpeed),
      MIN_CAMERA_SPEED,
      MAX_CAMERA_SPEED,
    );
  }

  private hasActiveMovement(): boolean {
    return Object.values(this.flags).some(Boolean);
  }

  private onPostRender(): void {
    if (!this.hasActiveMovement()) {
      return;
    }

    const camera = this.scene.camera;
    const height = Math.abs(camera.positionCartographic.height);

    // Lateral movement (AD): sqrt scaling for gentle curve at high altitude
    const lateralFactor = Math.max(Math.sqrt(height / 500), 1);
    const lateralStep = (this.cameraSpeed / 80) * lateralFactor;

    // Forward/backward (WS) and vertical (QE): linear scaling — faster far out, slower near surface
    const zoomFactor = Math.max(height / 500, 1);
    const zoomStep = (this.cameraSpeed / 80) * zoomFactor;

    // Compute ENU up/down vectors at current camera position
    const enuTransform = Transforms.eastNorthUpToFixedFrame(camera.positionWC);
    const upCol = Matrix4.getColumn(enuTransform, 2, scratchCartesian4);
    const globalUp = Cartesian3.fromElements(
      upCol.x,
      upCol.y,
      upCol.z,
      scratchUp,
    );
    const globalDown = Cartesian3.fromElements(
      -upCol.x,
      -upCol.y,
      -upCol.z,
      scratchDown,
    );

    if (this.flags.moveForward) camera.moveForward(zoomStep);
    if (this.flags.moveBackward) camera.moveBackward(zoomStep);
    if (this.flags.moveUp) camera.move(globalUp, zoomStep);
    if (this.flags.moveDown) camera.move(globalDown, zoomStep);
    if (this.flags.moveLeft) camera.moveLeft(lateralStep);
    if (this.flags.moveRight) camera.moveRight(lateralStep);

    // Look rotation
    const rotateStep = this.rotateSpeed;
    let hasRotation = false;
    let heading = camera.heading;
    let pitch = camera.pitch;

    if (this.flags.lookLeft) {
      heading -= rotateStep;
      hasRotation = true;
    }
    if (this.flags.lookRight) {
      heading += rotateStep;
      hasRotation = true;
    }
    if (this.flags.lookUp) {
      pitch += rotateStep;
      hasRotation = true;
    }
    if (this.flags.lookDown) {
      pitch -= rotateStep;
      hasRotation = true;
    }
    if (hasRotation) {
      camera.setView({ orientation: { heading, pitch } });
    }

    this.scene.requestRender();
  }

  destroy(): void {
    document.removeEventListener('keydown', this.keyDownHandler);
    document.removeEventListener('keyup', this.keyUpHandler);
    window.removeEventListener('blur', this.blurHandler);
    if (this.canvas) {
      this.canvas.removeEventListener('wheel', this.wheelHandler, {
        capture: true,
      } as EventListenerOptions);
      this.canvas.onclick = null;
      this.canvas = undefined;
    }
    if (this.unlistenPostRender) {
      this.unlistenPostRender();
    }
  }
}

const scratchCartesian4 = new Cartesian4();
const scratchUp = new Cartesian3();
const scratchDown = new Cartesian3();

function getFlagForKey(key: string): keyof MovementFlags | undefined {
  switch (key) {
    case 'w':
      return 'moveForward';
    case 's':
      return 'moveBackward';
    case 'q':
    case ' ':
    case '+':
      return 'moveUp';
    case 'e':
    case '-':
      return 'moveDown';
    case 'a':
      return 'moveLeft';
    case 'd':
      return 'moveRight';
    case 'i':
      return 'lookUp';
    case 'k':
      return 'lookDown';
    case 'j':
      return 'lookLeft';
    case 'l':
      return 'lookRight';
    default:
      return undefined;
  }
}

function isTargetNavigable(target: HTMLElement): boolean {
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    const type = (target as HTMLInputElement).type;
    return type === 'checkbox' || type === 'range';
  }
  return !target.isContentEditable;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wheelStep(currentSpeed: number, threshold = 50, power = 2): number {
  return Math.max(
    0.02,
    BASE_CAMERA_SPEED_STEP *
      (1 - Math.exp(-Math.pow(currentSpeed / threshold, power))),
  );
}
