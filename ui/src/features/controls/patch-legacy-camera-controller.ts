import { Scene } from 'cesium';

/**
 * Permanently disables the legacy monolithic `ScreenSpaceCameraController`.
 *
 * We drive the camera with the modular controllers instead
 * (`ScreenSpaceMapCameraController`, `ScreenSpaceTiltOrbitCameraController`,
 * `ScreenSpaceZoomCameraController`), so the legacy controller must never
 * process input — otherwise both handle the same mouse gestures at once.
 *
 * Assigning `enableInputs = false` once is *not* enough. CesiumJS's
 * `CameraFlightPath.createTween` — used by every `camera.flyTo()` and
 * `flyToBoundingSphere()` — does:
 *
 * ```js
 * const controller = scene.screenSpaceCameraController;
 * controller.enableInputs = false;
 * const complete = wrapCallback(controller, options.complete);
 * ```
 *
 * where `wrapCallback` unconditionally runs `controller.enableInputs = true`
 * once the flight completes or is cancelled. Cesium assumes it owns the flag
 * and restores it to `true` rather than to its previous value, so a single
 * flight silently resurrects the legacy controller. It then fights the modular
 * controllers for the same input, most visibly breaking orbit-around-a-point
 * (CTRL+Drag / middle-drag).
 *
 * This also fires when the camera is already at the flight destination:
 * `createTween` then short-circuits to `emptyFlight(complete, cancel)`, whose
 * `complete` runs on the very next frame. That is why even a no-op "fly home"
 * click — with the camera already at the home view — is enough to break
 * rotation.
 *
 * Resetting the flag from a `preUpdate`/`postRender` listener would not close
 * the gap either, because `Scene#initializeFrame` runs `this._tweens.update()`
 * (which fires the flight's `complete`) *before*
 * `this._screenSpaceCameraController.update()` within the same frame. Locking
 * the property is therefore the only reliable fix.
 *
 * See: https://github.com/swisstopo/swissgeol-viewer-suite/issues/2055
 * TODO: Remove once CesiumJS stops force-restoring `enableInputs`.
 */
export function patchLegacyCameraController(scene: Scene): void {
  const controller = scene.screenSpaceCameraController;

  controller.enableCollisionDetection = false;
  controller.enableInputs = false;

  Object.defineProperty(controller, 'enableInputs', {
    get: () => false,
    set: () => {
      // Intentionally ignored: Cesium re-enables this after every camera
      // flight, which would reactivate the legacy controller.
    },
    configurable: true,
    enumerable: true,
  });
}
