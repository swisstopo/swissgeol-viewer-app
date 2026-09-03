import { describe, expect, it } from 'vitest';
import {
  Cartesian2,
  Cartesian3,
  Ellipsoid,
  JulianDate,
  ScreenSpaceZoomCameraController,
} from 'cesium';
import { ApproachLimitedZoomCameraController } from './approach-limited-zoom.controller';

const CLIENT_WIDTH = 1600;
const CLIENT_HEIGHT = 900;

/**
 * Minimal stand-in for the parts of `Scene`/`Camera` that
 * `ScreenSpaceZoomCameraController#update` touches.
 */
const createScene = (position: Cartesian3) => {
  const camera = {
    position: Cartesian3.clone(position),
    direction: new Cartesian3(0, 0, -1),
    get positionWC() {
      return this.position;
    },
    move(direction: Cartesian3, amount: number) {
      this.position = Cartesian3.add(
        this.position,
        Cartesian3.multiplyByScalar(direction, amount, new Cartesian3()),
        new Cartesian3(),
      );
    },
  };
  return {
    canvas: { clientWidth: CLIENT_WIDTH, clientHeight: CLIENT_HEIGHT },
    camera,
    ellipsoid: Ellipsoid.WGS84,
  };
};

interface ControllerInternals {
  _lastUpdateTime: number;
  /** CesiumJS's own scroll accumulator, normally fed by its wheel handler. */
  _scrollDelta: number;
  /** CesiumJS's own drag accumulator, normally fed by its drag handler. */
  _dragDelta: Cartesian2;
  _dragInputState: { isDragging: boolean } | undefined;
  _screenSpaceDragPosition: Cartesian2;
  /** Our own frame clock, which must advance in step with CesiumJS's. */
  lastFrameTime: number;
}

const createController = (target: Cartesian3) => {
  const controller = new ApproachLimitedZoomCameraController();
  controller.pickGeometryPosition = (_scene, _windowPosition, result) =>
    Cartesian3.clone(target, result);
  return controller;
};

/**
 * Runs `frameCount` frames at a fixed `dt`. `scrollDelta` is fed on the first
 * frame only, unless `isHeld` is set, in which case every frame receives it.
 *
 * The delta is written to CesiumJS's own `_scrollDelta`, exactly as its wheel
 * handler does, so the controller reads it through the same path it does in the
 * browser.
 */
const run = (
  controller: ScreenSpaceZoomCameraController,
  scene: ReturnType<typeof createScene>,
  { scrollDelta = 0, frameCount = 1, dt = 1 / 60, isHeld = false } = {},
) => {
  const internals = controller as unknown as ControllerInternals;
  for (let frame = 0; frame < frameCount; frame++) {
    const delta = frame === 0 || isHeld ? scrollDelta : 0;
    internals._lastUpdateTime = performance.now() - dt * 1000;
    internals.lastFrameTime = performance.now() - dt * 1000;
    internals._scrollDelta = delta;
    controller.update(scene as never, JulianDate.now());
  }
};

describe('ApproachLimitedZoomCameraController', () => {
  const target = new Cartesian3(0, 0, 0);
  const start = new Cartesian3(0, 0, 1000);

  it('never travels more than the configured fraction of the distance in one frame', () => {
    const scene = createScene(start);
    const controller = createController(target);

    // A violent scroll burst (10 wheel notches) combined with a 20 FPS frame.
    run(controller, scene, { scrollDelta: 200, dt: 1 / 20 });

    const distance = Cartesian3.distance(scene.camera.positionWC, target);
    expect(distance).toBeGreaterThanOrEqual(
      1000 * (1 - controller.maximumApproachFraction) - 1e-6,
    );
  });

  it('never overshoots the target, even over a long burst', () => {
    const scene = createScene(start);
    const controller = createController(target);

    run(controller, scene, { scrollDelta: 200, dt: 1 / 20, frameCount: 200 });

    // Still on the near side of the target: z must not have flipped sign.
    expect(scene.camera.positionWC.z).toBeGreaterThan(0);
  });

  it('is not bounded by the stock controller, which does overshoot', () => {
    const scene = createScene(start);
    const stock = new ScreenSpaceZoomCameraController();
    stock.pickWorldPosition = (
      _scene: unknown,
      _windowPosition: Cartesian2,
      result: Cartesian3,
    ) => Cartesian3.clone(target, result);

    run(stock, scene, { scrollDelta: 200, dt: 1 / 20 });

    expect(scene.camera.positionWC.z).toBeLessThan(0);
  });

  it('keeps a single wheel notch at a moderate, distance-proportional step', () => {
    const scene = createScene(start);
    const controller = createController(target);
    controller.zoomDistanceRatio = 0.1;

    run(controller, scene, { scrollDelta: 20, frameCount: 120 });

    const travelled =
      1000 - Cartesian3.distance(scene.camera.positionWC, target);
    expect(travelled).toBeGreaterThan(0);
    expect(travelled).toBeLessThan(1000 * 0.15);
  });

  it('does not clamp zooming away from the target', () => {
    const scene = createScene(start);
    const controller = createController(target);

    run(controller, scene, { scrollDelta: -200, dt: 1 / 20 });

    expect(scene.camera.positionWC.z).toBeGreaterThan(2000);
  });

  it('still allows descending through the target while the user keeps scrolling', () => {
    const scene = createScene(new Cartesian3(0, 0, 2));
    const controller = createController(target);

    run(controller, scene, {
      scrollDelta: 20,
      dt: 1 / 60,
      frameCount: 20,
      isHeld: true,
    });

    expect(scene.camera.positionWC.z).toBeLessThan(0);
  });

  it('comes to rest instead of drifting through the target once input stops', () => {
    const scene = createScene(new Cartesian3(0, 0, 2));
    const controller = createController(target);

    run(controller, scene, { scrollDelta: 20, dt: 1 / 60, frameCount: 300 });

    expect(scene.camera.positionWC.z).toBeGreaterThan(0);
  });

  // The glide is where the danger sits: CesiumJS banks an absolute speed in m/s
  // that was derived from the distance at input time and never revisits it.
  describe('post-input glide', () => {
    const highStart = new Cartesian3(0, 0, 100_000);

    it('decays the banked velocity as the target draws nearer', () => {
      const scene = createScene(highStart);
      const controller = createController(target);

      run(controller, scene, { scrollDelta: 400, dt: 1 / 60, frameCount: 3 });
      const early = Math.abs(controller.debug.zoomVelocity);
      const earlyDistance = Cartesian3.distance(
        scene.camera.positionWC,
        target,
      );

      run(controller, scene, { dt: 1 / 60, frameCount: 20 });
      const late = Math.abs(controller.debug.zoomVelocity);
      const lateDistance = Cartesian3.distance(scene.camera.positionWC, target);

      expect(lateDistance).toBeLessThan(earlyDistance);
      // The speed must have fallen at least as steeply as the distance did.
      expect(late / early).toBeLessThanOrEqual(lateDistance / earlyDistance);
    });

    it('does not race through the target after a fast burst from high up', () => {
      const scene = createScene(highStart);
      const controller = createController(target);

      // 20 wheel notches in a single frame, then pure glide.
      run(controller, scene, { scrollDelta: 400, dt: 1 / 60, frameCount: 240 });

      expect(scene.camera.positionWC.z).toBeGreaterThan(0);
    });

    it('closes a comparable distance whatever the frame rate is', () => {
      const runFor = (dt: number, frameCount: number) => {
        const scene = createScene(highStart);
        const controller = createController(target);
        run(controller, scene, { scrollDelta: 400, dt, frameCount });
        return Cartesian3.distance(scene.camera.positionWC, target);
      };

      // One second of wall-clock time at 60 FPS versus a 10 FPS stall.
      const smooth = runFor(1 / 60, 60);
      const stuttering = runFor(1 / 10, 10);

      expect(stuttering).toBeGreaterThan(smooth * 0.5);
      expect(stuttering).toBeLessThan(smooth * 2);
    });

    it('reacts when the target suddenly turns out to be much nearer', () => {
      const scene = createScene(highStart);
      const controller = new ApproachLimitedZoomCameraController();
      const currentTarget = { value: target };
      controller.pickGeometryPosition = (_scene, _windowPosition, result) =>
        Cartesian3.clone(currentTarget.value, result);

      run(controller, scene, { scrollDelta: 400, dt: 1 / 60, frameCount: 5 });

      // Terrain refines, or the pointer ray drops onto a near ridge: the
      // surface is suddenly just ahead of a camera still carrying a speed
      // banked for a target 100 km away.
      const { z } = scene.camera.positionWC;
      currentTarget.value = new Cartesian3(0, 0, z - 50);

      run(controller, scene, { dt: 1 / 60, frameCount: 240 });

      expect(scene.camera.positionWC.z).toBeGreaterThan(z - 50);
    });
  });

  // The controller reads CesiumJS's own `dz` accumulators instead of mirroring
  // the DOM events, so these assert that the fields are still wired up and that
  // the sign really does mean what `minimumApproachStep` assumes it means.
  describe('zoom input detection', () => {
    it('reports fresh scroll input towards the target as zooming in', () => {
      const scene = createScene(start);
      const controller = createController(target);

      run(controller, scene, { scrollDelta: 20 });

      expect(controller.debug.isZoomingIn).toBe(true);
      // The sign is only meaningful if the camera really moved towards the
      // target on that same frame.
      expect(scene.camera.positionWC.z).toBeLessThan(start.z);
    });

    it('reports scroll input away from the target as not zooming in', () => {
      const scene = createScene(start);
      const controller = createController(target);

      run(controller, scene, { scrollDelta: -20 });

      expect(controller.debug.isZoomingIn).toBe(false);
      expect(scene.camera.positionWC.z).toBeGreaterThan(start.z);
    });

    it('accounts for drag input, not just the scroll wheel', () => {
      const scene = createScene(start);
      const controller = createController(target);
      const internals = controller as unknown as ControllerInternals;

      internals._lastUpdateTime = performance.now() - 1000 / 60;
      internals.lastFrameTime = performance.now() - 1000 / 60;
      internals._dragDelta.y = 20;
      controller.update(scene as never, JulianDate.now());

      expect(controller.debug.isZoomingIn).toBe(true);
      expect(scene.camera.positionWC.z).toBeLessThan(start.z);
    });

    it('treats the post-input glide as not zooming in', () => {
      const scene = createScene(start);
      const controller = createController(target);

      run(controller, scene, { scrollDelta: 20, frameCount: 2 });

      expect(controller.debug.isZoomingIn).toBe(false);
    });
  });

  // The zoom anchor. CesiumJS's own `_screenSpaceScrollPosition` cannot be used:
  // its `MOUSE_MOVE` action is overwritten by the drag bindings registered right
  // after it, so it never leaves (0, 0). These drive the pointer through the
  // same callback the controller registers on its own handler.
  describe('zoom origin', () => {
    const capture = (
      scene: ReturnType<typeof createScene>,
      configure: (
        controller: ApproachLimitedZoomCameraController,
        internals: ControllerInternals,
      ) => void = () => {},
    ) => {
      const controller = new ApproachLimitedZoomCameraController();
      const seen = new Cartesian2();
      controller.pickGeometryPosition = (_scene, windowPosition, result) => {
        Cartesian2.clone(windowPosition, seen);
        return Cartesian3.clone(target, result);
      };
      configure(controller, controller as unknown as ControllerInternals);
      run(controller, scene, { scrollDelta: 20 });
      return seen;
    };

    it('zooms at the screen centre until the pointer has moved', () => {
      const seen = capture(createScene(start));

      expect(seen.x).toBe(CLIENT_WIDTH / 2);
      expect(seen.y).toBe(CLIENT_HEIGHT / 2);
    });

    it('zooms at the pointer once it has moved', () => {
      const seen = capture(createScene(start), (controller) => {
        controller.handlePointerMove({ endPosition: new Cartesian2(100, 200) });
      });

      expect(seen).toEqual(new Cartesian2(100, 200));
    });

    it('follows the pointer as it keeps moving', () => {
      const seen = capture(createScene(start), (controller) => {
        controller.handlePointerMove({ endPosition: new Cartesian2(100, 200) });
        controller.handlePointerMove({ endPosition: new Cartesian2(640, 480) });
      });

      expect(seen).toEqual(new Cartesian2(640, 480));
    });

    it('does not alias the event position it was handed', () => {
      const position = new Cartesian2(100, 200);
      const seen = capture(createScene(start), (controller) => {
        controller.handlePointerMove({ endPosition: position });
        position.x = 999;
      });

      expect(seen).toEqual(new Cartesian2(100, 200));
    });

    it('keeps the anchor at the drag start while a zoom drag is in progress', () => {
      const seen = capture(createScene(start), (controller, internals) => {
        controller.handlePointerMove({ endPosition: new Cartesian2(100, 200) });
        internals._screenSpaceDragPosition.x = 300;
        internals._screenSpaceDragPosition.y = 400;
        internals._dragInputState = { isDragging: true };
      });

      expect(seen).toEqual(new Cartesian2(300, 400));
    });

    it('returns to the pointer once the zoom drag ends', () => {
      const seen = capture(createScene(start), (controller, internals) => {
        controller.handlePointerMove({ endPosition: new Cartesian2(100, 200) });
        internals._screenSpaceDragPosition.x = 300;
        internals._screenSpaceDragPosition.y = 400;
        internals._dragInputState = { isDragging: false };
      });

      expect(seen).toEqual(new Cartesian2(100, 200));
    });
  });
});
