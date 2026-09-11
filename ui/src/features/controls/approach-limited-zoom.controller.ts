import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  JulianDate,
  Ray,
  Scene,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  ScreenSpaceZoomCameraController,
} from 'cesium';
import { handleScenePickingError } from 'src/services/pick.service';

const scratchCameraPosition = new Cartesian3();
const scratchToTarget = new Cartesian3();
const scratchDirection = new Cartesian3();
const scratchDisplacement = new Cartesian3();
const scratchFallbackRay = new Ray();
const scratchFallbackOffset = new Cartesian3();
const scratchCartographic = new Cartographic();

/** Smallest distance, in meters, kept between the camera and the zoom target. */
const MINIMUM_TARGET_SEPARATION = 1e-4;

/** Frame duration assumed before a second frame has been observed. */
const DEFAULT_FRAME_SECONDS = 1 / 60;

/**
 * Shortest frame duration the approach rate is evaluated over, so that two
 * updates within the same clock tick cannot collapse the allowance to zero.
 */
const MINIMUM_FRAME_SECONDS = 1 / 240;

/**
 * Longest frame duration the approach rate is evaluated over. Without this, a
 * tab switch or a long tile-loading stall would produce a single frame that is
 * allowed to close nearly the whole distance to the target.
 */
const MAXIMUM_FRAME_SECONDS = 0.1;

export type PickWorldPosition = (
  scene: Scene,
  windowPosition: Cartesian2,
  result: Cartesian3,
) => Cartesian3 | undefined;

/** How the zoom target for the current frame was obtained. */
export type ZoomTargetSource =
  /** Depth buffer or ellipsoid hit under the pointer. */
  | 'geometry'
  /** Nothing was hit; a point along the pointer ray was synthesised. */
  | 'fallback'
  /** No target at all — CesiumJS's own ellipsoid-height fallback applies. */
  | 'none';

/** Which limit, if any, altered CesiumJS's zoom step this frame. */
export type ZoomClamp =
  | 'none'
  | 'maximumApproachRate'
  | 'maximumApproachFraction'
  | 'minimumApproachStep'
  | 'targetSeparation';

/**
 * Per-frame snapshot of the zoom decision, for the debug HUD
 * (`<control-zoom-debug>`). Mutated in place; never retain a reference to the
 * nested vectors.
 */
export interface ZoomDebugState {
  targetSource: ZoomTargetSource;
  /** Screen position, in CSS pixels, the zoom is aimed at. */
  readonly zoomOrigin: Cartesian2;
  /** World position the zoom is aimed at, if any. */
  readonly target: Cartesian3;
  /** Distance from the camera to the target, in meters. */
  distance: number;
  /** Distance CesiumJS moved the camera towards the target this frame. */
  requestedStep: number;
  /** Distance actually kept after clamping. */
  appliedStep: number;
  /**
   * Upper bound derived from `maximumApproachRate` and
   * `maximumApproachFraction`.
   */
  maximumStep: number;
  clamp: ZoomClamp;
  /** True while the frame carries fresh zoom-in input rather than glide. */
  isZoomingIn: boolean;
  /** Duration of the frame the decision was made for, in seconds. */
  frameSeconds: number;
  /** CesiumJS's banked zoom velocity before rescaling, in meters per second. */
  zoomVelocity: number;
  /** Factor the banked zoom velocity was rescaled by. */
  velocityScale: number;
}

export interface ApproachLimitedZoomOptions
  extends ScreenSpaceZoomCameraController.ControllerOptions {
  /**
   * The largest fraction of the remaining distance to the zoom target that the
   * camera may close per second.
   *
   * This is the primary speed limit. It is expressed per second rather than per
   * frame so that the zoom feels identical at 60 FPS and during the frame-rate
   * dips that fast descents cause while terrain tiles stream in.
   */
  readonly maximumApproachRate?: number;

  /**
   * Hard ceiling on the fraction of the remaining distance that may be closed
   * within a single frame, whatever `maximumApproachRate` works out to.
   */
  readonly maximumApproachFraction?: number;

  /**
   * The smallest step, in meters, that a frame carrying actual zoom-in input is
   * guaranteed to travel.
   *
   * CesiumJS's step is proportional to the distance to the target, so it decays
   * to nothing at the surface and the camera can never descend below it. Since
   * this viewer explicitly supports travelling underground, every frame with
   * fresh input is granted at least this much progress. It is not applied to the
   * post-input glide, so a released wheel still comes to rest.
   */
  readonly minimumApproachStep?: number;
}

/**
 * A {@link ScreenSpaceZoomCameraController} that keeps the scroll-wheel zoom
 * from flying through the terrain or the object being zoomed at.
 *
 * See https://github.com/swisstopo/swissgeol-viewer-suite/issues/2058.
 *
 * This is a plain subclass: it overrides the documented `Controller` lifecycle
 * methods and the documented
 * {@link ScreenSpaceZoomCameraController#pickWorldPosition} hook. It also reads
 * — and, for the banked velocity, writes — a handful of CesiumJS fields that are
 * annotated `@private` and therefore missing from `Cesium.d.ts`. Those accesses
 * all go through the guarded accessors at the bottom of the class and degrade
 * gracefully if a future release renames them; see the note on each one.
 *
 * ## Why this is needed
 *
 * CesiumJS's zoom step is already proportional to the ray-picked distance to the
 * target (`zoom = dz * distance * zoomDistanceRatio`), but nothing bounds the
 * result by that distance:
 *
 * - A browser wheel notch is `deltaY = ±100`, which becomes `dz = 20` after
 *   `zoomSensitivity`, so a single notch *requests* `20 * zoomDistanceRatio`
 *   times the distance — several times past the target. Only the `smoothDamp`
 *   low-pass keeps that survivable.
 * - Multiple notches within one frame (a fast flick, a trackpad, or simply a
 *   dropped frame) push the damped result beyond `distance` and the camera ends
 *   up behind the target — the "empty screen" reported in the issue.
 * - `maximumZoomVelocity` cannot prevent this: `update()` clamps `dz / dt` into
 *   an input velocity that only the (off by default) inertia path consumes,
 *   while the raw, unclamped `dz` drives the actual movement.
 *
 * The legacy monolithic `ScreenSpaceCameraController` did guard against this
 * (`handleZoom()` clamps the step to `distanceMeasure - minimumZoomDistance`),
 * but that safeguard was not carried over to the modular controllers, and none
 * of the public knobs (`zoomDistanceRatio`, `zoomSensitivity`,
 * `minimumZoomDistance`, `maximumZoomDistance`, `zoomAnimationDuration`) can
 * reinstate it — they all *scale* the step, none *bound* it. Hence
 * {@link ApproachLimitedZoomOptions.maximumApproachFraction}, applied in
 * {@link update} after CesiumJS has moved the camera.
 *
 * Unlike the legacy controller, the approach is only decelerated, never blocked:
 * this viewer lets users travel below the terrain surface.
 *
 * ## The glide carries a stale speed
 *
 * Bounding the per-frame step is not enough on its own. CesiumJS evaluates
 * `zoom = dz * distance * zoomDistanceRatio` **only on frames that carry input**
 * and hands that absolute metre value to `smoothDamp`, which then plays it out
 * over `zoomAnimationDuration`. During the glide `dz` is zero, so `distance`
 * stops entering the equation entirely: the banked velocity is a speed in m/s
 * derived from however far away the target was *when the wheel was turned*.
 *
 * Flick the wheel hard from high altitude and the controller banks a velocity
 * suited to a target tens of kilometres away, then keeps it while the last few
 * hundred metres close — the glide simply does not know that the terrain came
 * rushing up in the meantime. A per-frame cap fights that every frame without
 * ever resolving it, and it breaks down as soon as the distance changes for a
 * reason other than our own movement (the pointer ray dropping past a ridge
 * onto a far valley, or terrain LOD refining the surface upwards).
 *
 * {@link update} therefore rescales the banked velocity by the fraction of the
 * distance that remains after each frame. That makes the residual speed
 * proportional to the distance instead of absolute, turning the glide into a
 * true exponential approach that decelerates on its own — whatever caused the
 * distance to shrink.
 *
 * ## Zoom target selection
 *
 * CesiumJS 1.144/1.145 declare `usePointerPosition` but read an (unassigned)
 * `useDragPosition` in `update()`, so the public property is a no-op and the
 * built-in zoom always targets the *screen centre* — usually the far horizon in
 * a tilted view, which makes every notch overshoot whatever the user is actually
 * pointing at.
 *
 * Rather than assigning the internal property, this controller resolves the
 * target from the pointer inside `pickWorldPosition`, which CesiumJS documents
 * as the supported way to choose "the world position from which to zoom".
 *
 * The pointer position has to be tracked by this controller, because CesiumJS's
 * own `_screenSpaceScrollPosition` is never updated: `connectedCallback()`
 * registers `_handleZoomPosition` on `MOUSE_MOVE`, and then
 * `ScreenSpaceInputBindings.registerDragInputBindings()` registers its drag
 * `change` callback on `MOUSE_MOVE` with the *same* modifier. A
 * `ScreenSpaceEventHandler` keeps only one action per (type, modifier) pair, so
 * the second registration silently replaces the first and the field stays at its
 * initial `(0, 0)`. That is the deeper reason `usePointerPosition` cannot work
 * upstream. A separate handler is immune, since it owns its own action table.
 *
 * The drag anchor (`_screenSpaceDragPosition`, set from the button-down event)
 * is unaffected by that clash and is used as-is, which keeps the `dragInputs`
 * bindings and their keyboard modifiers in CesiumJS's hands.
 *
 * ---
 *
 * **This is a temporary patch against upstream defects in `cesium@1.144.0`, not
 * a permanent customisation.** None of the above can be fixed by configuration:
 * `maximumZoomVelocity` and `maximumZoomDistance` have no effect, and
 * `usePointerPosition` is never read. Once a CesiumJS release bounds the zoom
 * step, honours `usePointerPosition` and fixes the ellipsoid fallback, this
 * whole class should be deleted in favour of plain configuration — see
 * *"Upstream, and how to remove this override"* in `docs/camera-zoom.md` for the
 * acceptance checks and the step-by-step removal. The test
 * `is not bounded by the stock controller, which does overshoot` is the tripwire:
 * when it starts failing, upstream has fixed the main defect.
 */
export class ApproachLimitedZoomCameraController extends ScreenSpaceZoomCameraController {
  readonly maximumApproachRate: number;
  readonly maximumApproachFraction: number;
  readonly minimumApproachStep: number;

  /**
   * Resolves the world position under a screen position. Assign the same
   * depth-buffer-aware pick used by the other camera controllers.
   */
  pickGeometryPosition: PickWorldPosition = (scene, windowPosition, result) =>
    scene.camera.pickEllipsoid(windowPosition, scene.ellipsoid, result);

  /** @see ZoomDebugState */
  readonly debug: ZoomDebugState = {
    targetSource: 'none',
    zoomOrigin: new Cartesian2(),
    target: new Cartesian3(),
    distance: Number.NaN,
    requestedStep: 0,
    appliedStep: 0,
    maximumStep: Number.NaN,
    clamp: 'none',
    isZoomingIn: false,
    frameSeconds: DEFAULT_FRAME_SECONDS,
    zoomVelocity: 0,
    velocityScale: 1,
  };

  private readonly zoomOrigin = new Cartesian2();
  private readonly pointerPosition = new Cartesian2();
  private hasPointerPosition = false;
  private handler: ScreenSpaceEventHandler | undefined;
  private target: Cartesian3 | undefined;
  private lastFrameTime: number | undefined;

  constructor(options: ApproachLimitedZoomOptions = {}) {
    super(options);

    this.maximumApproachRate = options.maximumApproachRate ?? 3.0;
    this.maximumApproachFraction = options.maximumApproachFraction ?? 0.2;
    this.minimumApproachStep = options.minimumApproachStep ?? 0.5;

    // The `windowPosition` handed in by CesiumJS is unusable (see the class
    // doc), so the tracked pointer position is used instead.
    //
    // This runs on every zoom frame and is invoked directly by CesiumJS
    // (`ScreenSpaceZoomCameraController.update()`), with no try/catch of its
    // own — the same call site whose unguarded `Scene.pickPosition()` failure
    // used to freeze the whole UI (see `handleScenePickingError`). Both picks
    // below (`pickGeometryPosition`, typically `pickWorldPositionWithDepthBuffer`,
    // and the terrain-height lookup in `pickFallbackPosition`) can throw while
    // tiles are still loading or the scene is mid-teardown, so the whole hook
    // is wrapped defensively: any pick error degrades to "no target"
    // (CesiumJS's own no-target fallback then applies) instead of aborting the
    // frame. `update()` (see below) is itself also wrapped, as a last-resort
    // safety net for anything not caught here.
    this.pickWorldPosition = (
      scene: Scene,
      _windowPosition: Cartesian2,
      result: Cartesian3,
    ): Cartesian3 | undefined => {
      try {
        const geometry = this.pickGeometryPosition(
          scene,
          this.zoomOrigin,
          result,
        );
        if (geometry !== undefined) {
          this.debug.targetSource = 'geometry';
          this.target = geometry;
          return geometry;
        }

        const fallback = pickFallbackPosition(scene, this.zoomOrigin, result);
        this.debug.targetSource = fallback === undefined ? 'none' : 'fallback';
        this.target = fallback;
        return fallback;
      } catch (e) {
        handleScenePickingError(e);
        this.debug.targetSource = 'none';
        this.target = undefined;
        return undefined;
      }
    };
  }

  /**
   * Records the pointer position for {@link resolveZoomOrigin}.
   *
   * Registered as the `MOUSE_MOVE` action of this controller's own handler; a
   * bound property so that it can be registered and unit-tested directly.
   */
  readonly handlePointerMove = (event: {
    readonly endPosition: Cartesian2;
  }): void => {
    Cartesian2.clone(event.endPosition, this.pointerPosition);
    this.hasPointerPosition = true;
  };

  connectedCallback(element: HTMLElement): void {
    super.connectedCallback(element);

    // Tolerate a repeated connect without an intervening disconnect, which
    // would otherwise leak the previous handler.
    this.destroyHandler();

    const handler = new ScreenSpaceEventHandler(element as HTMLCanvasElement);
    this.handler = handler;
    handler.setInputAction(
      this.handlePointerMove,
      ScreenSpaceEventType.MOUSE_MOVE,
    );
  }

  disconnectedCallback(element: HTMLElement): void {
    this.destroyHandler();
    this.hasPointerPosition = false;
    super.disconnectedCallback(element);
  }

  firstUpdate(scene: Scene, time: JulianDate): void {
    super.firstUpdate(scene, time);
    this.lastFrameTime = undefined;
  }

  update(scene: Scene, time: JulianDate): void {
    // Any uncaught exception here would be thrown from inside
    // `ControllerHost.update()`, which CesiumJS's `CesiumWidget` render loop
    // calls *before* the internal try/catch that raises `Scene#renderError`.
    // Such an exception instead reaches the render loop's own outer
    // try/catch, which permanently stops calling `requestAnimationFrame` —
    // silently, since this app sets `showRenderLoopErrors: false` — freezing
    // the map forever with no console output. See
    // `reorthonormalizeCameraFrame` in `patch-tilt-nadir-gimbal-lock.ts` for
    // the full mechanism (discovered via exactly this failure mode). Guard
    // against it here too so any future/unknown throw becomes a single
    // skipped frame plus a visible error instead of a silent, unrecoverable
    // freeze.
    try {
      this.updateUnsafe(scene, time);
    } catch (e) {
      console.error(
        '[ApproachLimitedZoomCameraController] update() threw and was ' +
          'skipped for this frame to avoid silently freezing the render loop:',
        e,
      );
    }
  }

  private updateUnsafe(scene: Scene, time: JulianDate): void {
    this.resolveZoomOrigin(scene);

    // Must be read *before* `super.update()`, which consumes and clears it.
    const isZoomingIn = this.pendingZoomInput > 0;

    const now = performance.now();
    const frameSeconds =
      this.lastFrameTime === undefined
        ? DEFAULT_FRAME_SECONDS
        : Math.min(
            Math.max((now - this.lastFrameTime) / 1000, MINIMUM_FRAME_SECONDS),
            MAXIMUM_FRAME_SECONDS,
          );
    this.lastFrameTime = now;

    const debug = this.debug;
    debug.frameSeconds = frameSeconds;
    debug.zoomVelocity = this.bankedZoomVelocity ?? 0;
    debug.velocityScale = 1;
    debug.isZoomingIn = isZoomingIn;
    debug.targetSource = 'none';
    debug.distance = Number.NaN;
    debug.maximumStep = Number.NaN;
    debug.requestedStep = 0;
    debug.appliedStep = 0;
    debug.clamp = 'none';
    Cartesian2.clone(this.zoomOrigin, debug.zoomOrigin);

    const { camera } = scene;
    const positionBefore = Cartesian3.clone(
      camera.positionWC,
      scratchCameraPosition,
    );

    this.target = undefined;
    super.update(scene, time);

    const target = this.target;
    if (target === undefined) {
      return;
    }
    Cartesian3.clone(target, debug.target);

    const toTarget = Cartesian3.subtract(
      target,
      positionBefore,
      scratchToTarget,
    );
    const distance = Cartesian3.magnitude(toTarget);
    debug.distance = distance;
    if (distance <= 0) {
      return;
    }
    const direction = Cartesian3.divideByScalar(
      toTarget,
      distance,
      scratchDirection,
    );

    const displacement = Cartesian3.subtract(
      camera.positionWC,
      positionBefore,
      scratchDisplacement,
    );
    const step = Cartesian3.dot(displacement, direction);
    debug.requestedStep = step;
    debug.appliedStep = step;

    // The rate is the real speed limit and is evaluated over the frame's actual
    // duration, so a 10 FPS stall cannot close as much ground as six 60 FPS
    // frames would have. The fraction is a hard ceiling for pathological frames.
    const rateFraction = 1 - Math.exp(-this.maximumApproachRate * frameSeconds);
    const isRateBinding = rateFraction < this.maximumApproachFraction;
    const maximumStep =
      distance * Math.min(rateFraction, this.maximumApproachFraction);
    debug.maximumStep = maximumStep;

    // Only the approach is bounded; zooming away from the target is harmless.
    if (step < 0) {
      return;
    }

    let clampedStep = Math.min(step, maximumStep);
    if (clampedStep < step) {
      debug.clamp = isRateBinding
        ? 'maximumApproachRate'
        : 'maximumApproachFraction';
    }
    if (isZoomingIn && clampedStep < this.minimumApproachStep) {
      clampedStep = this.minimumApproachStep;
      debug.clamp = 'minimumApproachStep';
    }

    // Landing exactly on the target would leave CesiumJS with a zero-length
    // zoom direction on the next frame, which `Cartesian3.normalize` rejects
    // with a `DeveloperError`. Always keep a sliver of separation.
    if (Math.abs(distance - clampedStep) < MINIMUM_TARGET_SEPARATION) {
      clampedStep = distance + MINIMUM_TARGET_SEPARATION;
      debug.clamp = 'targetSeparation';
    }

    debug.appliedStep = clampedStep;

    if (clampedStep !== step) {
      camera.move(direction, clampedStep - step);
    }

    // Re-anchor CesiumJS's banked velocity to the distance that is actually
    // left, so the post-input glide decelerates as the target draws nearer
    // instead of coasting on a speed computed for a target that was far away.
    const remaining = Math.max(distance - clampedStep, 0);
    const velocityScale = Math.min(remaining / distance, 1);
    debug.velocityScale = velocityScale;
    this.scaleZoomVelocity(velocityScale);
  }

  /**
   * CesiumJS's damped zoom velocity, or `undefined` if the accessor is gone.
   *
   * `zoomVelocity` is a real accessor on `ScreenSpaceZoomCameraController` (its
   * own `update()` both reads and writes it), but it is annotated `@private` and
   * therefore absent from `Cesium.d.ts`. Everything here degrades to the plain
   * step clamp if a future release drops it, so it is read and written
   * defensively rather than through a blanket cast.
   */
  private get bankedZoomVelocity(): number | undefined {
    const velocity = (this as unknown as { zoomVelocity?: unknown })
      .zoomVelocity;
    return typeof velocity === 'number' && Number.isFinite(velocity)
      ? velocity
      : undefined;
  }

  /**
   * The zoom input CesiumJS will act on this frame — exactly the `dz` its
   * `update()` computes as `_scrollDelta + _dragDelta.y`, before it consumes and
   * clears both.
   *
   * Reading CesiumJS's own accumulators rather than mirroring the DOM events
   * with a second `ScreenSpaceEventHandler` is deliberate: a mirror has to
   * re-implement the wheel/drag sign convention, the `dragInputs` and
   * `scrollInputs` bindings and their keyboard modifiers, and the `enabled`
   * flag, and it silently desynchronises the moment any of those change.
   *
   * The sign needs no convention of its own: CesiumJS moves the camera by
   * `dz * distance * zoomDistanceRatio` along a direction that points *at* the
   * zoom target, so `dz > 0` is by construction a movement towards it.
   * {@link ApproachLimitedZoomCameraController.test} asserts that invariant.
   *
   * Returns `0` if a future release renames the fields, which only disables the
   * {@link ApproachLimitedZoomOptions.minimumApproachStep} boost.
   */
  private get pendingZoomInput(): number {
    const { _scrollDelta: scrollDelta, _dragDelta: dragDelta } =
      this as unknown as {
        _scrollDelta?: unknown;
        _dragDelta?: { y?: unknown };
      };
    const scroll = typeof scrollDelta === 'number' ? scrollDelta : 0;
    const drag = typeof dragDelta?.y === 'number' ? dragDelta.y : 0;
    return scroll + drag;
  }

  /**
   * The anchor of an in-progress zoom drag, i.e. where the button went down.
   *
   * `_screenSpaceDragPosition` and `isDragging` are `@private` and thus absent
   * from `Cesium.d.ts`. Unlike `_screenSpaceScrollPosition` they *are* kept up
   * to date (see the class doc), and reading them leaves the `dragInputs`
   * bindings and their keyboard modifiers in CesiumJS's hands.
   *
   * Returns `undefined` when no zoom drag is in progress, or if a future release
   * renames the fields — in which case the live pointer position is used.
   */
  private get dragAnchorPosition(): Cartesian2 | undefined {
    const { isDragging, _screenSpaceDragPosition: dragPosition } =
      this as unknown as {
        isDragging?: unknown;
        _screenSpaceDragPosition?: unknown;
      };
    if (isDragging !== true) {
      return undefined;
    }
    return dragPosition instanceof Cartesian2 ? dragPosition : undefined;
  }

  private scaleZoomVelocity(scale: number): void {
    const velocity = this.bankedZoomVelocity;
    if (velocity === undefined) {
      return;
    }
    (this as unknown as { zoomVelocity: number }).zoomVelocity =
      velocity * scale;
  }

  private destroyHandler(): void {
    if (this.handler !== undefined && !this.handler.isDestroyed()) {
      this.handler.destroy();
    }
    this.handler = undefined;
  }

  private resolveZoomOrigin(scene: Scene): void {
    // While a zoom drag is in progress the anchor stays where the gesture
    // started, matching the behaviour of the tilt and pan controllers.
    const anchor = this.dragAnchorPosition;
    if (anchor !== undefined) {
      Cartesian2.clone(anchor, this.zoomOrigin);
      return;
    }

    // Zoom from the screen centre until the pointer has been seen at least
    // once, so that input arriving beforehand does not aim at the top-left
    // corner.
    if (!this.hasPointerPosition) {
      const { clientWidth, clientHeight } = scene.canvas;
      this.zoomOrigin.x = clientWidth / 2;
      this.zoomOrigin.y = clientHeight / 2;
      return;
    }
    Cartesian2.clone(this.pointerPosition, this.zoomOrigin);
  }
}

/**
 * Fallback for when nothing can be picked under the pointer, e.g. when the ray
 * points at the sky or up from underground.
 *
 * CesiumJS's own fallback computes
 * `magnitude(camera.positionWC) - ellipsoid.maximumRadius`. `maximumRadius` is
 * the *equatorial* radius (6'378'137 m), while the geocentric radius at Swiss
 * latitudes is only about 6'365'000 m, so at 2'000 m above Switzerland it yields
 * **-9'319 m** instead of `+2'000 m` — wrong by a factor of ~4.6 and, worse,
 * negative, which flips the zoom direction and makes the camera bolt backwards.
 *
 * Returning a target along the pointer ray at the camera's height above terrain
 * keeps the zoom speed tied to a meaningful distance and avoids that branch
 * entirely.
 */
function pickFallbackPosition(
  scene: Scene,
  windowPosition: Cartesian2,
  result: Cartesian3,
): Cartesian3 | undefined {
  const { camera, globe } = scene;

  const ray = camera.getPickRay(windowPosition, scratchFallbackRay);
  if (ray === undefined) {
    return undefined;
  }

  const cartographic = Cartographic.fromCartesian(
    camera.positionWC,
    scene.ellipsoid,
    scratchCartographic,
  );
  if (cartographic === undefined) {
    return undefined;
  }

  const terrainHeight = globe?.getHeight(cartographic) ?? 0;
  const distance = Math.abs(cartographic.height - terrainHeight);
  if (distance <= 0) {
    return undefined;
  }

  const offset = Cartesian3.multiplyByScalar(
    ray.direction,
    distance,
    scratchFallbackOffset,
  );
  return Cartesian3.add(ray.origin, offset, result);
}
