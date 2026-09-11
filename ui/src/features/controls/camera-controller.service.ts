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
  Viewer,
} from 'cesium';
import { firstValueFrom } from 'rxjs';
import { patchTiltNadirGimbalLock } from 'src/features/controls/patch-tilt-nadir-gimbal-lock';
import { patchLegacyCameraController } from 'src/features/controls/patch-legacy-camera-controller';
import { ApproachLimitedZoomCameraController } from 'src/features/controls/approach-limited-zoom.controller';
import { handleScenePickingError } from 'src/services/pick.service';
import { pickPositionWithRay } from 'src/cesiumutils';

/**
 * Custom pick function that uses the depth buffer first (picks actual rendered
 * geometry and terrain), then falls back to a math-based ray cast against the
 * terrain, and only then to the ellipsoid.
 *
 * The terrain ray cast is essential, not just a nicety: `Scene.pickPosition`
 * reads the depth buffer, which the globe does not write to while it is
 * rendered translucently (background map opacity < 100%, or a transparent
 * variant — see `LayerBackgroundController`/`globe.translucency`). Over plain
 * terrain the depth pick then returns nothing.
 *
 * Falling straight through to `Camera.pickEllipsoid` in that case returns a
 * point on the WGS84 ellipsoid, i.e. *below* the actual ground — by up to
 * several kilometres in the Alps. Every consumer of this function measures the
 * distance to the returned point, so the result is a distance that is far too
 * large: the zoom controller's approach limiter then permits steps that are
 * multiples of the real distance to the surface and the camera shoots through
 * the (visible) terrain. Ray-casting the terrain first keeps the target on the
 * surface the user actually sees, whatever the globe's opacity is.
 */
export function pickWorldPositionWithDepthBuffer(
  scene: Scene,
  windowPosition: Cartesian2,
  result: Cartesian3,
): Cartesian3 | undefined {
  // Try depth buffer first — this picks on actual rendered geometry/terrain.
  // `scene.pickPosition` can throw while tiles are still loading (see
  // `handleScenePickingError`); fall back to the ray-based picks instead of
  // letting the exception abort the drag.
  try {
    const depthPick = scene.pickPosition(windowPosition, result);
    if (defined(depthPick) && !Cartesian3.equals(depthPick, Cartesian3.ZERO)) {
      return depthPick;
    }
  } catch (e) {
    handleScenePickingError(e);
  }

  // Depth-buffer pick unavailable (most commonly: translucent globe).
  // Intersect the terrain geometrically, and only use the ellipsoid if the
  // globe is hidden or the ray misses it entirely.
  return (
    pickPositionWithRay(scene, windowPosition, result) ??
    scene.camera.pickEllipsoid(windowPosition, scene.ellipsoid, result)
  );
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

  readonly zoomController = new ApproachLimitedZoomCameraController({
    dragInputs: [{ button: MouseButton.RIGHT }],
  });

  private isInputsEnabled = true;
  private readonly activeControllers: Set<Controller> = new Set();

  constructor() {
    super();

    this.tiltController.useDragPosition = true;
    this.tiltController.orbitMagnitude = -2.0;
    this.tiltController.maximumOrbitVelocity = -CesiumMath.TWO_PI;

    // A browser wheel notch (`deltaY = 100`) becomes `dz = 20` after
    // `zoomSensitivity`, so one notch travels roughly
    // `20 * zoomDistanceRatio * distance`, smoothed over `zoomAnimationDuration`.
    // `0.1` puts a single notch at ~7% of the distance to the zoom target, which
    // matches the legacy monolithic controller (`zoomFactor * 7.5°/notch`) and is
    // noticeably calmer than Cesium's `0.4` default.
    this.zoomController.zoomDistanceRatio = 0.1;

    // Use depth-buffer-aware picking for correct underground behavior.
    this.tiltController.pickWorldPosition = pickWorldPositionWithDepthBuffer;
    this.panController.pickWorldPosition = pickWorldPositionWithDepthBuffer;
    // The zoom controller resolves its own target from the tracked pointer
    // position, so it takes the pick function through a dedicated property.
    this.zoomController.pickGeometryPosition = pickWorldPositionWithDepthBuffer;

    // Fix CesiumJS's nadir/zenith heading-flip gimbal lock bug (see the
    // function doc for the full root-cause analysis and links).
    patchTiltNadirGimbalLock(this.tiltController);

    BaseService.onReady(() => void this.setup());
  }

  private async setup(): Promise<void> {
    const cesiumService = await CesiumService.inject();
    const viewer = await firstValueFrom(cesiumService.viewer$);
    this.initialize(viewer);
  }

  private initialize(viewer: Viewer): void {
    this.viewer = viewer;

    // Disable the old monolithic controller.
    //
    // This *locks* `enableInputs` to `false` rather than merely assigning it,
    // because Cesium force-restores the flag to `true` after every camera flight
    // TODO: A cesium PR is on its way. remove the patch as soon as it is merged
    const scene = viewer.scene;
    patchLegacyCameraController(scene);

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
    // Cesium's `ControllerHost` has no de-dup guard of its own: it appends
    // to a plain array on every `addController()` call, so calling it twice
    // for the same controller instance registers it twice, causing its
    // `update()` to run multiple times per frame (e.g. doubling pan/tilt/zoom
    // speed). Only forward to the viewer if this controller isn't already
    // tracked as active.
    const isAlreadyActive = this.activeControllers.has(controller);
    this.activeControllers.add(controller);
    if (!isAlreadyActive && this.isInputsEnabled && this.viewer) {
      this.viewer.addController(controller);
    }
  }

  removeController(controller: Controller): void {
    const wasActive = this.activeControllers.delete(controller);
    if (wasActive && this.viewer) {
      this.viewer.removeController(controller);
    }
  }
}
