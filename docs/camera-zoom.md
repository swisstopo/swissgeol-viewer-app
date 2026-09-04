# Camera zoom

How scroll-wheel / trackpad zoom works in this viewer, and how it differs from
stock CesiumJS.

Related issue: [#2058](https://github.com/swisstopo/swissgeol-viewer-suite/issues/2058)
("Dynamische Zoom Geschwindigkeit abhängig von der Distanz zum Ziel").

- Implementation: `ui/src/features/controls/approach-limited-zoom.controller.ts`
- Wiring: `ui/src/features/controls/camera-controller.service.ts`
- Debug HUD: `ui/src/features/controls/control-zoom-debug.element.ts`

All CesiumJS references below were verified against the checked-out engine
source at commit `6228ed4` (2026-08-28), which matches the released
`cesium@1.144`/`1.145` behaviour.

---

## 1. What stock CesiumJS does

Since 1.144 the monolithic `ScreenSpaceCameraController` has been superseded by
composable controllers. We use `ScreenSpaceZoomCameraController`, whose entire
zoom decision is these few lines of
`packages/engine/Source/Scene/Controllers/ScreenSpaceZoomCameraController.js`:

```js
// L336-341
let direction = camera.direction;
let distance =
  Cartesian3.magnitude(camera.positionWC) - ellipsoid.maximumRadius;

// L343-350 — pick the screen position to zoom at
let windowPosition = this.isDragging
  ? this._screenSpaceDragPosition
  : this._screenSpaceScrollPosition;
if (!this.useDragPosition) {
  windowPosition = this._screenSpaceOrigin;
  windowPosition.x = clientWidth / 2.0;
  windowPosition.y = clientHeight / 2.0;
}

// L351-360 — ray-pick the zoom target
const target = this.pickWorldPosition(scene, windowPosition, this._target);
if (defined(target)) {
  direction = normalize(subtract(target, camera.positionWC));
  distance = Cartesian3.distance(target, camera.positionWC);
}

// L368-383 — the step
const zoom = dz * distance * this.zoomDistanceRatio;
this._zoomDampenedResults = CesiumMath.smoothDamp(0, zoom, this.zoomVelocity, dt, ...);
camera.move(direction, this.zoomDistance);
```

The important part: **the step is already proportional to the ray-picked
distance to the target**, which is exactly what the issue asks for. Zoom speed
is not derived from vertical height above terrain. The problems are elsewhere.

### 1.1 The step is unbounded

`dz` is the wheel delta accumulated during the frame. A browser wheel notch is
`deltaY = ±100`, which `ScreenSpaceEventHandler` turns into `amount = 100`, and
`zoomSensitivity = 0.2` turns into `dz = 20`. With Cesium's default
`zoomDistanceRatio = 0.4` a **single notch requests `20 × 0.4 = 8 × distance`** —
eight times past the target. Nothing clamps `zoom` to `distance`; only the
`smoothDamp` low-pass keeps that from being instantly fatal.

Consequences:

- Several notches inside one frame (fast flick, trackpad, or a dropped frame)
  push the damped result beyond `distance`, and the camera ends up **behind**
  the object — the empty screen reported in the issue.
- Because `smoothDamp` carries an absolute (m/s) velocity across frames while
  `distance` keeps shrinking, the _relative_ approach speed accelerates as you
  get closer. That is the "gets faster the closer you get" sensation.

`maximumZoomVelocity` looks like the remedy but is not: `update()` only clamps
`dz / dt` into `_zoomInputVelocity` (L330-335), which is consumed **exclusively**
by the inertia branch (L310-315, off by default). The raw, unclamped `dz` drives
the actual movement.

Measured with a numerical simulation of `update()` (60 FPS unless noted,
`d₀ = 1000 m`, our `zoomDistanceRatio = 0.1`):

| Input                             | Travel            | Result                   |
| --------------------------------- | ----------------- | ------------------------ |
| 1 notch                           | 7.3 % of distance | fine                     |
| 3 notches over 3 frames           | 21.6 %            | fine                     |
| 10 notches in **one** frame       | 72.6 %            | close call               |
| 5 notches in one frame @ 20 FPS   | **105 %**         | flies through the target |
| same, with Cesium's default `0.4` | **>130 %**        | flies far through        |

### 1.2 Zoom-to-cursor does not work

The constructor declares `usePointerPosition` (L67) but `update()` reads
`this.useDragPosition` (L346), which is never assigned on this class. The public
property is therefore a **no-op**, `!undefined` is always `true`, and the zoom
always targets the **screen centre**.

In a tilted 3D view the screen centre is usually far behind whatever the user is
pointing at — often the horizon. `distance` is then huge, so a step of "7 % of
distance" is enormous relative to the object under the cursor, and you shoot
straight past it. This is the single largest contributor to the reported
symptom.

The bug is still present at upstream HEAD (`6228ed4`).

Fixing that property alone would not be enough, because the pointer position it
would read is itself never updated — see §1.2b.

### 1.2b The tracked pointer position is silently overwritten

`connectedCallback()` registers `_handleZoomPosition` — the callback that keeps
`_screenSpaceScrollPosition` current — on `MOUSE_MOVE`, and then immediately
calls `ScreenSpaceInputBindings.registerDragInputBindings()`, which registers its
drag `change` callback on `MOUSE_MOVE` with the **same** modifier (`undefined`
for our bindings):

```js
// ScreenSpaceZoomCameraController.js, connectedCallback()
handler.setInputAction(
  this._handleZoomPosition.bind(this),
  ScreenSpaceEventType.MOUSE_MOVE,
);
this._dragInputState = ScreenSpaceInputBindings.registerDragInputBindings(
  handler,
  this.dragInputs,
  {
    start: this._handleStartDrag.bind(this),
    change: this._handleDrag.bind(this),
  },
);

// ScreenSpaceInputBindings.js, registerDragInputBindings()
handler.setInputAction(
  changeCallback,
  ScreenSpaceEventType.MOUSE_MOVE,
  modifier,
);
```

A `ScreenSpaceEventHandler` stores exactly one action per (type, modifier) pair,
so the second registration **replaces** the first. `_screenSpaceScrollPosition`
therefore never leaves its initial `(0, 0)`.

This is why we track the pointer with our own `ScreenSpaceEventHandler`: a
separate instance owns its own action table and cannot be clobbered. The drag
anchor (`_screenSpaceDragPosition`, written from the button-down event) is not
affected by the clash, so it is read from CesiumJS directly — that keeps the
`dragInputs` bindings and their keyboard modifiers in CesiumJS's hands.

### 1.3 The fallback distance is wrong outside the equator

When `pickWorldPosition` returns `undefined` (cursor on the sky, or looking up
from underground), `distance` keeps its seed value from L340:

```js
Cartesian3.magnitude(camera.positionWC) - ellipsoid.maximumRadius;
```

`maximumRadius` is the **equatorial** radius (6 378 137 m), but the geocentric
radius at Swiss latitudes is only ≈6 365 000 m. Evaluated for lat 46.8°:

| Camera height | Cesium's `distance` | Error                      |
| ------------- | ------------------- | -------------------------- |
| 2 000 m       | **−9 319 m**        | wrong sign, 4.7× too large |
| 20 000 m      | 8 681 m             | 2.3× too small             |
| 300 000 m     | 288 679 m           | ~4 % too small             |

A negative `distance` flips `zoom`, so the camera bolts backwards. This branch is
reachable in normal use here because the viewer is frequently tilted towards the
horizon or looking up from below the surface.

### 1.4 The glide plays back a speed that is already out of date

`zoom = dz * distance * zoomDistanceRatio` (L368) is only evaluated on frames
that carry input. That absolute metre value goes into `smoothDamp`, which plays
it out over `zoomAnimationDuration` (0.45 s). On every following frame `dz` is
`0`, so `distance` **drops out of the equation entirely** — the residual
velocity is a speed in m/s derived from however far away the target was at the
moment the wheel was turned.

Flick the wheel hard from 100 km up and the controller banks a velocity suited
to a target 100 km away, then keeps that speed while the last few hundred metres
close. The glide has no idea the terrain came rushing up in the meantime.

A per-frame cap does not really fix this. It fights the stale velocity on every
single frame without ever discharging it, so the camera simply pins to the cap
for the whole glide — the maximum permitted approach rate, sustained, which is
what "racing through the terrain" feels like. It also stops protecting anything
as soon as the distance changes for a reason other than our own movement:

- the pointer ray drops past a ridge and lands on a valley far behind it,
- terrain LOD refines and the surface moves up towards the camera,
- the depth pick fails transiently while tiles stream in.

The fix is to make the residual speed **proportional to the distance** rather
than absolute, by rescaling the banked velocity by the fraction of the distance
that is left after each frame. The glide then becomes a true exponential
approach that decelerates by itself, whatever made the distance shrink.

### 1.5 The depth buffer is empty while the globe is translucent

This one is not a CesiumJS defect but a trap for anyone picking with
`Scene.pickPosition`, and it bit us here.

The viewer enables `scene.globe.translucency` whenever the background map's
opacity is below 100 % or a transparent variant is selected
(`LayerBackgroundController`). A translucent globe is drawn in the translucent
pass and does **not** write to the depth buffer, so `Scene.pickPosition` returns
`undefined` over plain terrain — silently, without throwing.

Our pick chain then dropped through to `Camera.pickEllipsoid`, which returns a
point on the WGS84 **ellipsoid** rather than on the ground. In Switzerland that
is 400–4 500 m below the visible surface. Since the whole throttle is derived
from the distance to the target, the measured distance became far larger than
the real distance to the terrain, `maximumApproachFraction × distance` stopped
constraining anything near the surface, and the camera punched straight through
the terrain again — but only when the base map was not fully opaque, which is
what made it look intermittent.

The fix is to insert a math-based ray cast against the terrain
(`Globe.pick`, via `pickPositionWithRay` in `cesiumutils.ts`) between the depth
pick and the ellipsoid pick. It is independent of the depth buffer, so it
returns the actual surface whatever the globe's opacity is. `cesiumutils`
already used this fallback for scene picking; the camera controllers did not.

### 1.6 What the old monolithic controller did better

`ScreenSpaceCameraController.handleZoom()` had guards that were **not** carried
over to the modular controllers
(`packages/engine/Source/Scene/ScreenSpaceCameraController.js`):

| Guard                                                                                                                            | Line |
| -------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `rangeWindowRatio = Math.min(rangeWindowRatio, object.maximumMovementRatio)` — hard cap of 10 % of the window per frame          | 595  |
| `if (distanceMeasure - distance < minHeight) distance = distanceMeasure - minHeight - 1.0` — the step can never reach the target | 612  |
| `enableCollisionDetection` — terrain penetration blocked                                                                         | —    |

Its per-notch step also came out far gentler: `CameraEventAggregator` converts a
wheel notch to `arcLength = 7.5 * toRadians(delta)` (L179) ≈ 13 px, which with
`zoomFactor = 5.0` (L145) yields **≈7.3 % of the distance per notch**.

---

## 2. What we do differently

`ApproachLimitedZoomCameraController` is a plain **subclass** of
`ScreenSpaceZoomCameraController`. It is not a patch: it overrides documented
`Controller` lifecycle methods and the documented `pickWorldPosition` hook, and
never reaches into a CesiumJS underscore-prefixed field.

The one exception is `zoomVelocity`, used for the glide rescaling in §1.4. It is
a real accessor on the class — CesiumJS's own `update()` both reads and writes it
— but it is annotated `@private`, so it is missing from `Cesium.d.ts`. It is
therefore read and written defensively: if a future release removes it, the
rescaling silently stops and the step clamp alone remains in force.

| #   | Stock CesiumJS                                                                                    | This viewer                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Zoom target = **screen centre** (`usePointerPosition` is a no-op)                                 | Zoom target = **pointer position**, tracked with our own `ScreenSpaceEventHandler` and resolved inside `pickWorldPosition`. The broken property is never touched.                                                                                                    |
| 2   | Target picked by `defaultPickWorldPosition` (ellipsoid / focus plane)                             | Target picked by `pickGeometryPosition` — the shared pick, so it hits **real geometry**: terrain, 3D Tiles, voxels, GeoTIFF surfaces. It tries the depth buffer, then a terrain ray cast (needed while the globe is translucent, §1.5), and only then the ellipsoid. |
| 3   | Pick failure ⇒ `magnitude(positionWC) − maximumRadius` (see §1.3)                                 | Pick failure ⇒ synthetic target along the pointer ray at the camera's height above terrain. Cesium's broken branch is unreachable.                                                                                                                                   |
| 4   | Step **unbounded** by the target distance                                                         | Step clamped to `maximumApproachFraction` (0.2) of the distance per frame. No burst or frame drop can punch through.                                                                                                                                                 |
| 5   | Step decays to zero at the surface, so you only get underground by overshooting                   | Frames carrying **fresh zoom-in input** get at least `minimumApproachStep` (0.5 m), so descending below terrain stays possible — but controlled, and only while actively scrolling. The post-input glide never gets the floor, so a released wheel comes to rest.    |
| 6   | `zoomDistanceRatio = 0.4` (≈29 % of distance per notch)                                           | `zoomDistanceRatio = 0.1` (≈7.3 % per notch), matching the legacy controller.                                                                                                                                                                                        |
| 7   | Camera may land exactly on the target ⇒ `Cartesian3.normalize` throws `DeveloperError` next frame | A `targetSeparation` epsilon (0.1 mm) always keeps the camera off the singularity.                                                                                                                                                                                   |

### Why not just configure it?

Every public knob — `zoomDistanceRatio`, `zoomSensitivity`, `minimumZoomDistance`,
`maximumZoomDistance`, `zoomAnimationDuration`, `maximumZoomVelocity`,
`inertiaEnabled` — **scales** the step. None **bounds** it by the distance to the
target, and none can reach the broken `useDragPosition` branch. A configuration-
only fix is therefore not possible; subclassing is the smallest correct
intervention.

Note that `minimumZoomDistance` is actively unhelpful here: it is a _floor on the
distance fed into the ratio_ (L362-366), so raising it makes the camera move
**faster** near the target, not slower.

### Order of operations per frame

```
update(scene, time)
  ├─ zoom origin = zoom-drag anchor, else our tracked pointer
  │    (screen centre until the pointer is first seen)
  ├─ isZoomingIn = Cesium's own dz (_scrollDelta + _dragDelta.y) > 0
  │    read before super.update() consumes it — fresh input vs. glide
  ├─ remember camera position
  ├─ super.update()                        ← Cesium moves the camera
  │    └─ calls our pickWorldPosition       ← records target + targetSource
  ├─ step = (newPosition − oldPosition) · directionToTarget
  ├─ clamp: min(step, maxStep) → max(…, 0.5 m if isZoomingIn) → separation
  │    maxStep = distance × min(1 − e^(−rate·dt), maximumApproachFraction)
  ├─ camera.move(direction, clampedStep − step)   ← correction, same frame
  └─ zoomVelocity ×= (distance − clampedStep) / distance   ← discharge the glide
```

The correction lands in the same frame: `ControllerHost.update()` runs from
`Scene.render()` **before** the frame is drawn, so no intermediate position is
ever visible.

---

## 3. Debug HUD

Enable the HUD with the `zoomDebug` URL flag (e.g. `?zoomDebug`) to get
`<control-zoom-debug>` in the lower-left corner. It samples at 10 Hz and shows:

| Field                    | Meaning                                                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Picked object**        | What sits under the zoom origin: 3D Tile feature (with name and tileset), entity, primitive class, `Terrain (globe)`, or `nothing (sky)`. |
| **Depth buffer**         | Whether `Scene.pickPosition` resolved the target, and whether globe translucency is why it could not (§1.5).                              |
| **Target source**        | `depth buffer / terrain ray` (normal), `ray fallback (nothing hit)` (§1.3 branch avoided), or `none`.                                     |
| **Zoom origin (px)**     | Screen position the zoom is aimed at — verifies zoom-to-cursor.                                                                           |
| **Distance to target**   | The value that drives the step.                                                                                                           |
| **Height above terrain** | For contrast: what a naive elevation-based implementation would have used.                                                                |
| **Requested step**       | How far CesiumJS moved the camera this frame.                                                                                             |
| **Applied step**         | How far it was allowed to keep.                                                                                                           |
| **Max step**             | `distance × min(1 − e^(−rate·dt), maximumApproachFraction)`.                                                                              |
| **Applied / distance**   | The step as a percentage — should stay ≤20 %.                                                                                             |
| **Limit**                | Highlighted in yellow when a limit engaged: `maximumApproachFraction`, `minimumApproachStep` or `targetSeparation`.                       |
| **Input this frame**     | `zooming in` (fresh input) vs. `glide` (damped tail).                                                                                     |
| **Frame time**           | The `dt` the approach rate was evaluated over — watch this spike while terrain tiles stream in.                                           |
| **Banked velocity**      | CesiumJS's residual zoom speed before rescaling. This is the value that used to outlive the geometry it was computed for (§1.4).          |
| **Velocity rescaled to** | The fraction the banked velocity was cut to this frame. Highlighted whenever the glide is being discharged.                               |

The bottom block lists the live tuning values so they can be compared against
the defaults documented above.

### Reproducing the original bug

1. Open the viewer with `?zoomDebug` and tilt the camera so the horizon is
   visible.
2. Point the cursor at a building or borehole in the lower half of the screen.
3. Flick the wheel hard. Watch **Limit** turn yellow and **Applied / distance**
   stay at 20 % instead of exceeding 100 %.
4. Compare **Distance to target** (small, the object) with **Height above
   terrain** — before the fix, the step was derived from the screen-centre
   distance instead, which is typically orders of magnitude larger.

---

## 4. Upstream, and how to remove this override

### Why this override exists at all

We would much rather configure the stock controller than subclass it. We cannot,
for two reasons.

1. **The knobs that sound like they would fix this do nothing.**
   `maximumZoomVelocity` never limits the zoom speed, and `maximumZoomDistance`
   never bounds the camera — see [§Why not just configure it?](#why-not-just-configure-it).
   There is no supported value of any public property that prevents the overshoot.
2. **`usePointerPosition` is not honoured**, so zoom-to-cursor — the behaviour
   the property is documented to provide — cannot be switched on at all (§1.2,
   §1.2b).

Both are defects in `cesium@1.144.0` rather than gaps in its feature set, so the
override is a **temporary patch against upstream bugs**, not a product decision.
It is deliberately built as a subclass that reuses CesiumJS's own damping,
inertia and input handling, and only intervenes at the two points where the
stock behaviour is wrong. That keeps the surface to delete small.

This is the same arrangement as `patch-legacy-camera-controller.ts` and
`patch-tilt-nadir-gimbal-lock.ts`: local, self-contained, and to be dropped once
the fix ships upstream.

### When it can be removed

Delete the override once a CesiumJS release satisfies **all** of the following.
Each is directly asserted by a test in `approach-limited-zoom.controller.test.ts`,
so the checks are cheap to run against a new version.

| #   | Condition                                                                                                                                                         | How to check                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The zoom step is bounded by the distance to the target, so a large `dz` at a low frame rate cannot move the camera past — or through — the thing being zoomed at. | The control case `is not bounded by the stock controller, which does overshoot` in the test file must start **failing**. That test exists precisely as a tripwire for this. |
| 2   | `usePointerPosition = true` actually zooms towards the cursor.                                                                                                    | Set it on a stock `ScreenSpaceZoomCameraController` and confirm `pickWorldPosition` receives the pointer position rather than the canvas centre.                            |
| 3   | The no-target fallback distance is a real height above the surface and never goes negative outside the tropics.                                                   | Zoom in with the cursor on the sky over Switzerland; the camera must not move _away_ from the ground.                                                                       |
| 4   | The damped glide re-evaluates its speed against the current distance instead of replaying the speed banked at input time (§1.4).                                  | Zoom hard towards a small object and release; the tail of the movement must not overshoot it.                                                                               |

Conditions 1–3 are hard blockers. Condition 4 is a quality issue: without it the
glide will still overshoot, so keep the `scaleZoomVelocity` rescaling even if 1–3 are
fixed and the rest of the subclass goes.

### How to remove it

1. In `camera-controller.service.ts`, swap `ApproachLimitedZoomCameraController`
   back for `ScreenSpaceZoomCameraController` and set `usePointerPosition = true`
   alongside the existing `zoomDistanceRatio` and `pickWorldPosition`
   assignments.
2. Delete `approach-limited-zoom.controller.ts` and
   `approach-limited-zoom.controller.test.ts`.
3. Delete `control-zoom-debug.element.ts`, its import in `controls.module.ts`,
   the `showZoomDebug` state and `when()` block in `ngm-app.ts`, and
   `getZoomDebugParam()` in `permalink.ts`. The HUD only reports this
   subclass's internals and has no meaning without it.
4. Delete this document.

**Keep** the changes to `pickWorldPositionWithDepthBuffer` and
`pickPositionWithRay` (§1.5). They fix our own picking under a translucent
globe, are independent of the zoom controller, and are used elsewhere.

Then re-run the manual check in
[§Reproducing the original bug](#reproducing-the-original-bug) with `?zoomDebug`
removed: tilt the horizon into view, point at a small object low on the screen,
and flick the wheel hard. If the camera still shoots past it, upstream is not
fixed yet — restore the override.
