import { BaseService } from 'src/services/base.service';
import { CesiumService } from 'src/services/cesium.service';
import {
  Cartesian2,
  Cartesian3,
  Controller,
  defined,
  KeyboardEventModifier,
  Math as CesiumMath,
  MouseButton,
  Scene,
  ScreenSpaceMapCameraController,
  ScreenSpaceTiltOrbitCameraController,
  ScreenSpaceZoomCameraController,
  Viewer,
} from 'cesium';
import { firstValueFrom } from 'rxjs';

/**
 * Custom pick function that uses the depth buffer first (picks actual rendered geometry
 * and terrain), then falls back to the default ellipsoid/plane picking.
 * This ensures correct behavior both above and below terrain.
 */
function pickWorldPositionWithDepthBuffer(
  scene: Scene,
  windowPosition: Cartesian2,
  result: Cartesian3,
): Cartesian3 | undefined {
  // Try depth buffer first — this picks on actual rendered geometry/terrain
  const depthPick = scene.pickPosition(windowPosition, result);
  if (defined(depthPick) && !Cartesian3.equals(depthPick, Cartesian3.ZERO)) {
    return depthPick;
  }

  // Fall back to ellipsoid pick
  return scene.camera.pickEllipsoid(windowPosition, scene.ellipsoid, result);
}

/**
 * Manages the new modular CesiumJS camera controllers (CesiumJS 1.144+).
 * Replaces the monolithic `ScreenSpaceCameraController` for mouse/touch input.
 *
 * Uses `ScreenSpaceMapCameraController` which provides map-style panning (looking down)
 */
export class CameraControllerService extends BaseService {
  private viewer!: Viewer;

  readonly panController = new ScreenSpaceMapCameraController();

  readonly tiltController = new ScreenSpaceTiltOrbitCameraController({
    dragInputs: [
      { button: MouseButton.MIDDLE },
      { button: MouseButton.LEFT, modifier: KeyboardEventModifier.CTRL },
    ],
  });

  readonly zoomController = new ScreenSpaceZoomCameraController({
    dragInputs: [{ button: MouseButton.RIGHT }],
  });

  private isInputsEnabled = true;
  private readonly activeControllers: Set<Controller> = new Set();

  constructor() {
    super();

    this.tiltController.useDragPosition = true;
    this.tiltController.orbitMagnitude = -2.0;
    this.tiltController.maximumOrbitVelocity = -CesiumMath.TWO_PI;
    this.zoomController.zoomDistanceRatio = 0.15;

    // Use depth-buffer-aware picking for correct underground behavior.
    this.tiltController.pickWorldPosition = pickWorldPositionWithDepthBuffer;
    this.zoomController.pickWorldPosition = pickWorldPositionWithDepthBuffer;
    this.panController.pickWorldPosition = pickWorldPositionWithDepthBuffer;

    CesiumService.inject()
      .then((s) => firstValueFrom(s.viewer$))
      .then((viewer) => this.initialize(viewer));
  }

  private initialize(viewer: Viewer): void {
    this.viewer = viewer;

    // Disable the old monolithic controller
    const scene = viewer.scene;
    scene.screenSpaceCameraController.enableInputs = false;
    scene.screenSpaceCameraController.enableCollisionDetection = false;

    // Add the new modular controllers
    this.addController(this.panController);
    this.addController(this.tiltController);
    this.addController(this.zoomController);
  }

  get enableInputs(): boolean {
    return this.isInputsEnabled;
  }

  /**
   * Enable or disable all camera input controllers.
   * Use this to temporarily suspend camera interaction (e.g. during draw/slice operations).
   */
  set enableInputs(isEnabled: boolean) {
    if (this.isInputsEnabled === isEnabled) {
      return;
    }
    this.isInputsEnabled = isEnabled;

    if (isEnabled) {
      for (const controller of this.activeControllers) {
        this.viewer.addController(controller);
      }
    } else {
      for (const controller of this.activeControllers) {
        this.viewer.removeController(controller);
      }
    }
  }

  addController(controller: Controller): void {
    this.activeControllers.add(controller);
    if (this.isInputsEnabled && this.viewer) {
      this.viewer.addController(controller);
    }
  }

  removeController(controller: Controller): void {
    this.activeControllers.delete(controller);
    if (this.viewer) {
      this.viewer.removeController(controller);
    }
  }
}
