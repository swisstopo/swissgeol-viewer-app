import {
  Camera,
  Cartesian3,
  Ellipsoid,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  Quaternion,
  ScreenSpaceTiltOrbitCameraController,
  Transforms,
} from 'cesium';

const scratchRotationQuaternion = new Quaternion();
const scratchRotationMatrix = new Matrix3();
const scratchOffset = new Cartesian3();
const scratchLookOffset = new Cartesian3();
const scratchLookTarget = new Cartesian3();
const scratchRotatedOffset = new Cartesian3();

const scratchOrbitRotationQuaternion = new Quaternion();
const scratchOrbitRotationMatrix = new Matrix3();
const scratchOrbitTargetEnu = new Matrix4();
const scratchOrbitTargetEast = new Cartesian3();
const scratchOrbitTargetOffset = new Cartesian3();
const scratchOrbitRotatedTargetOffset = new Cartesian3();

/**
 * Internal (undocumented in the public .d.ts, but present at runtime) members
 * of `ScreenSpaceTiltOrbitCameraController` that the original `tilt()`/`orbit()`
 * implementations rely on for their damping/velocity state.
 */
interface TiltControllerInternals {
  readonly isDragging: boolean;
  readonly minimumTiltVelocity: number;
  readonly minimumOrbitVelocity: number;
  readonly _tiltDampenedResults: { value: number; velocity: number };
  readonly _orbitDampenedResults: { value: number; velocity: number };
}

/**
 * Patches `ScreenSpaceTiltOrbitCameraController#tilt` *and* `#orbit` to fix a
 * CesiumJS gimbal-lock bug: tilting the camera to exactly nadir/zenith
 * (pitch = ±90°) causes `camera.heading` to flip 180° back and forth, and the
 * map orientation jumps uncontrollably.
 *
 * Root cause (verified in @cesium/engine 1.144, `Camera.js#lookAtWorldPosition`):
 * both `tilt()` and `orbit()` end by calling
 * `camera.lookAtWorldPosition(lookTarget, ellipsoid)`, which reconstructs the
 * camera's `right`/`up` vectors via `Cartesian3.cross(direction, worldUp)`. At
 * exact nadir/zenith, `direction` is (anti-)parallel to `worldUp`, so this
 * cross product degenerates to zero, and Cesium falls back to reusing the
 * camera's *previous* `right` vector — which flips sign unpredictably due to
 * floating-point noise, producing the 180° heading flip.
 *
 * `orbit()` runs on *every* drag frame right before `tilt()` (see `update()`),
 * so patching `tilt()` alone was not sufficient: `orbit()` hits the exact same
 * singularity independently (its own `lookAtWorldPosition` call), even for a
 * purely vertical drag, because damping inertia can leave a tiny non-zero
 * `orbitVelocity` that still triggers the call. Both methods must be patched.
 *
 * This patch keeps the exact same damping/velocity/position math as the
 * original `tilt()`/`orbit()`, but replaces the final `lookAtWorldPosition`
 * call with a direct rotation of the camera's existing
 * `direction`/`up`/`right` vectors by the same rotation matrix already used to
 * move the camera's position — the same technique CesiumJS's own
 * `Camera.prototype.rotate()` uses internally. Because this never
 * reconstructs the frame from a fixed world-space reference (`worldUp`), it
 * stays continuous through the pole and cannot flip.
 *
 * TODO: Remove this patch once CesiumJS fixes the underlying issue upstream.
 * See: https://github.com/CesiumGS/cesium/issues/13676
 */
export function patchTiltNadirGimbalLock(
  controller: ScreenSpaceTiltOrbitCameraController,
): void {
  const internals = controller as unknown as TiltControllerInternals;

  controller.tilt = guardCameraMutator(
    'tilt',
    (
      camera: Camera,
      target: Cartesian3,
      axis: Cartesian3,
      amount: number,
      dt: number,
      _ellipsoid: Ellipsoid = Ellipsoid.default,
    ): void => {
      const dampened = internals._tiltDampenedResults;

      if (
        globalThis.Math.abs(dampened.velocity) < internals.minimumTiltVelocity
      ) {
        dampened.velocity = 0.0;
      }

      // Apply inertia
      if (!internals.isDragging && controller.dampingEnabled) {
        amount += dampened.velocity * dt;
      }

      if (amount === 0.0) {
        return;
      }

      const currentTiltAngle = Cartesian3.angleBetween(camera.direction, axis);

      // Avoid large deltas when the sign is close to flipping, which can happen
      // when the camera is looking straight down at the ellipsoid.
      if (
        (currentTiltAngle < CesiumMath.PI_OVER_TWO && amount > 0.0) ||
        (currentTiltAngle > CesiumMath.PI_OVER_TWO && amount < 0.0)
      ) {
        amount *= globalThis.Math.abs(globalThis.Math.sin(currentTiltAngle));
      }

      const targetTiltAngle = currentTiltAngle + amount;

      const maxSpeed = controller.dampingEnabled
        ? controller.maximumTiltVelocity * controller.tiltMagnitude
        : undefined;
      const smoothTime = controller.dampingEnabled
        ? controller.tiltAnimationDuration
        : undefined;

      CesiumMath.smoothDamp(
        currentTiltAngle,
        targetTiltAngle,
        dampened.velocity,
        dt,
        maxSpeed,
        smoothTime,
        dampened,
      );

      const theta = dampened.value - currentTiltAngle;
      const rotation = Matrix3.fromQuaternion(
        Quaternion.fromAxisAngle(
          camera.rightWC,
          -theta,
          scratchRotationQuaternion,
        ),
        scratchRotationMatrix,
      );

      const offset = Cartesian3.subtract(
        camera.position,
        target,
        scratchOffset,
      );
      const t = Cartesian3.dot(offset, camera.directionWC);
      const lookOffset = Cartesian3.multiplyByScalar(
        camera.directionWC,
        t,
        scratchLookOffset,
      );
      const lookTarget = Cartesian3.subtract(
        camera.position,
        lookOffset,
        scratchLookTarget,
      );
      const rotatedOffset = Matrix3.multiplyByVector(
        rotation,
        lookOffset,
        scratchRotatedOffset,
      );

      Cartesian3.add(lookTarget, rotatedOffset, camera.position);

      // Instead of camera.lookAtWorldPosition(lookTarget, ellipsoid) — which
      // reconstructs right/up via cross(direction, worldUp) and degenerates at
      // the pole — rotate the existing direction/up vectors directly by the
      // same rotation matrix, then re-orthonormalize. This mirrors what
      // Camera.prototype.rotate() does and stays continuous through nadir.
      Matrix3.multiplyByVector(rotation, camera.direction, camera.direction);
      Matrix3.multiplyByVector(rotation, camera.up, camera.up);
      reorthonormalizeCameraFrame(camera);
    },
  );

  controller.orbit = guardCameraMutator(
    'orbit',
    (
      camera: Camera,
      target: Cartesian3,
      axis: Cartesian3,
      amount: number,
      dt: number,
      ellipsoid: Ellipsoid = Ellipsoid.default,
    ): void => {
      const dampened = internals._orbitDampenedResults;

      const enu = Transforms.eastNorthUpToFixedFrame(
        target,
        ellipsoid,
        scratchOrbitTargetEnu,
      );
      const east = Matrix4.multiplyByPointAsVector(
        enu,
        Cartesian3.UNIT_X,
        scratchOrbitTargetEast,
      );
      const currentOrbitAngle = Cartesian3.angleBetween(
        camera.directionWC,
        east,
      );

      if (
        globalThis.Math.abs(dampened.velocity) < internals.minimumOrbitVelocity
      ) {
        dampened.velocity = 0.0;
      }

      // Apply inertia
      if (!internals.isDragging && controller.dampingEnabled) {
        amount += dampened.velocity * dt;
      }

      if (amount === 0.0) {
        return;
      }

      const targetOrbitAngle = currentOrbitAngle + amount;

      const maxSpeed = controller.dampingEnabled
        ? controller.maximumOrbitVelocity * controller.orbitMagnitude
        : undefined;
      const smoothTime = controller.dampingEnabled
        ? controller.orbitAnimationDuration
        : undefined;

      CesiumMath.smoothDamp(
        currentOrbitAngle,
        targetOrbitAngle,
        dampened.velocity,
        dt,
        maxSpeed,
        smoothTime,
        dampened,
      );

      const rho = dampened.value - currentOrbitAngle;
      const rotation = Matrix3.fromQuaternion(
        Quaternion.fromAxisAngle(axis, -rho, scratchOrbitRotationQuaternion),
        scratchOrbitRotationMatrix,
      );

      const targetOffset = Cartesian3.subtract(
        camera.positionWC,
        target,
        scratchOrbitTargetOffset,
      );

      const rotatedTargetOffset = Matrix3.multiplyByVector(
        rotation,
        targetOffset,
        scratchOrbitRotatedTargetOffset,
      );

      Cartesian3.add(target, rotatedTargetOffset, camera.position);

      // As with tilt() above, avoid camera.lookAtWorldPosition() here — it
      // reconstructs right/up via cross(direction, worldUp) and degenerates at
      // the pole. Rotate the existing direction/up vectors directly instead.
      Matrix3.multiplyByVector(rotation, camera.direction, camera.direction);
      Matrix3.multiplyByVector(rotation, camera.up, camera.up);
      reorthonormalizeCameraFrame(camera);
    },
  );
}

/**
 * Signature shared by `ScreenSpaceTiltOrbitCameraController#tilt`/`#orbit`.
 */
type CameraMutator = (
  camera: Camera,
  target: Cartesian3,
  axis: Cartesian3,
  amount: number,
  dt: number,
  ellipsoid?: Ellipsoid,
) => void;

/**
 * Wraps a `tilt()`/`orbit()` implementation so that any exception it throws is
 * logged and swallowed instead of propagating into `ControllerHost.update()`.
 *
 * An uncaught exception there is fatal in a way that is easy to miss: it is
 * thrown *before* CesiumJS's own per-frame try/catch (`Scene#renderError`)
 * gets a chance to see it (see `reorthonormalizeCameraFrame`'s doc for the
 * full mechanism), so it instead reaches `CesiumWidget`'s render-loop
 * try/catch, which permanently stops calling `requestAnimationFrame` — with
 * no console output at all when `showRenderLoopErrors` is `false`, as it is in
 * this app. Guarding every custom camera-mutating function this way turns
 * that silent, unrecoverable freeze into a single skipped frame plus a
 * visible error.
 */
function guardCameraMutator(name: string, fn: CameraMutator): CameraMutator {
  return (camera, target, axis, amount, dt, ellipsoid) => {
    try {
      fn(camera, target, axis, amount, dt, ellipsoid);
    } catch (e) {
      console.error(
        `[patchTiltNadirGimbalLock] ${name}() threw and was skipped for this frame ` +
          'to avoid silently freezing the render loop:',
        e,
      );
    }
  };
}

/**
 * Re-normalizes and re-orthogonalizes the camera's `direction`/`up`/`right`
 * basis in place after `tilt()`/`orbit()` rotate it directly.
 *
 * `Matrix3.multiplyByVector` and `Cartesian3.cross` preserve unit length and
 * orthogonality only in exact arithmetic. In floating point, every frame's
 * rotation introduces a tiny rounding error, and neither `tilt()` nor
 * `orbit()` ever corrected for it (the "re-orthogonalize" comment was
 * aspirational — no `normalize()` call actually existed). Over many frames of
 * sustained panning/orbiting the basis drifts further from orthonormal each
 * time, until some later, unrelated piece of CesiumJS's own per-frame camera
 * math (which assumes a unit/orthogonal basis) hits a degenerate vector and
 * throws a `DeveloperError`.
 *
 * That throw happens inside `ControllerHost.update()`, which CesiumJS's
 * `CesiumWidget` render loop calls *before* the internal try/catch that raises
 * `Scene#renderError` (see `Scene.prototype.render`/`tryAndCatchError` in
 * `@cesium/engine`). An error there is instead caught by the render loop's own
 * outer `try/catch`, which permanently stops calling `requestAnimationFrame`
 * (silently, since this app sets `showRenderLoopErrors: false` and the loop
 * itself never logs) — freezing the map forever with no console output, while
 * the rest of the page (built on separate DOM/RxJS state) stays fully
 * responsive. See https://github.com/swisstopo/swissgeol-viewer-suite/issues/2058.
 *
 * `Cartesian3.normalize` itself throws a `DeveloperError` on a zero-length
 * input. That should no longer happen now that drift is corrected every
 * frame, but since a throw here would reproduce the exact freeze this
 * function exists to prevent, each normalize is skipped (keeping the
 * pre-rotation vector) rather than allowed to throw if a component ever does
 * degenerate to zero.
 */
function reorthonormalizeCameraFrame(camera: Camera): void {
  if (!safeNormalize(camera.direction)) {
    return;
  }
  Cartesian3.cross(camera.direction, camera.up, camera.right);
  if (!safeNormalize(camera.right)) {
    return;
  }
  Cartesian3.cross(camera.right, camera.direction, camera.up);
  safeNormalize(camera.up);
}

/**
 * Normalizes `vector` in place, returning whether it was non-degenerate
 * (finite and non-zero) and therefore safe to normalize at all.
 */
function safeNormalize(vector: Cartesian3): boolean {
  const magnitude = Cartesian3.magnitude(vector);
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return false;
  }
  Cartesian3.divideByScalar(vector, magnitude, vector);
  return true;
}
