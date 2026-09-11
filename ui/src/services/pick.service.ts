import {
  Cartesian2,
  Cartesian3,
  Ellipsoid,
  IntersectionTests,
  Ray,
  Viewer,
} from 'cesium';
import { firstValueFrom } from 'rxjs';
import { BaseService } from 'src/services/base.service';
import { CesiumService } from 'src/services/cesium.service';

/**
 * `Scene.pickPosition` (and `Scene.pick`) can throw while some tiles/
 * primitives are not yet fully loaded, or after the scene/camera has been
 * destroyed mid-pick. The exact error text for these failures is unstable —
 * it differs by browser engine and has even changed across Firefox versions/
 * builds for the same underlying condition (observed: "Can't access property
 * _target, v3 is undefined", "can't access property \"_target\", v is
 * undefined", "Cannot read properties of undefined (reading '_target')",
 * ...). Matching on that text is therefore a losing battle.
 *
 * Instead, every pick call site treats *any* exception from these functions
 * as recoverable: log it (so it's never silent — an uncaught exception here
 * has previously frozen the whole render loop with zero console output, see
 * git history) and degrade gracefully instead of propagating the exception —
 * typically by falling back to a less accurate, math-based pick, but exactly
 * what "degrade gracefully" means (fallback pick, `undefined`/no target, a
 * placeholder debug string, ...) is up to the caller.
 */
export function handleScenePickingError(e: unknown): void {
  console.warn(
    '[pick] Scene.pickPosition/pick threw; degrading gracefully for this call.',
    e,
  );
}

export class PickService extends BaseService {
  private viewer: Viewer | null = null;

  private disableCount = 0;

  constructor() {
    super();

    CesiumService.inject()
      .then((s) => firstValueFrom(s.viewer$))
      .then((viewer) => {
        this.viewer = viewer;
      });
  }

  /**
   * Find the position on the map that is displayed at a specific window coordinate.
   *
   * @param windowPosition The position on the window.
   * @return the corresponding world position.
   */
  pick(windowPosition: Cartesian2): Cartesian3 | null {
    if (this.viewer === null) {
      return null;
    }
    if (
      this.disableCount === 0 &&
      this.viewer.scene.pickPositionSupported &&
      this.viewer.scene.globe.show
    ) {
      return (
        this.tryPickWithSceneOrFallback(windowPosition) ??
        this.pickWithMath(windowPosition)
      );
    } else {
      return this.pickWithMath(windowPosition);
    }
  }

  private pickWithScene(position: Cartesian2): Cartesian3 | null {
    return this.viewer!.scene.pickPosition(position) ?? null;
  }

  private tryPickWithSceneOrFallback(position: Cartesian2): Cartesian3 | null {
    try {
      return this.pickWithScene(Cartesian2.clone(position));
    } catch (e) {
      handleScenePickingError(e);
      return this.pickWithMath(position);
    }
  }

  private pickWithMath(position: Cartesian2): Cartesian3 | null {
    const { viewer } = this;
    if (viewer === null) {
      return null;
    }

    // Determine the position of the click on the globe via a ray cast onto the WGS ellipsoid.
    // This method works even with the globe turned off, unlike `scene.pickPosition`.
    // It also doesn't trigger any weird errors happening around picking while specific tiles aren't fully loaded yet.
    // However, it may not be as accurate as `scene.pickPosition`,
    // especially in regard to specific positions on elevated or sunken terrain.
    const ray = viewer!.camera.getPickRay(position);
    if (ray === undefined) {
      return null;
    }
    if (viewer.scene.globe.show) {
      const globePick = viewer.scene.globe.pick(ray, viewer.scene);
      if (globePick !== undefined) {
        return globePick;
      }
      // `Globe.pick` only intersects the terrain surface itself. When the
      // camera is underground and looking away from the terrain (e.g. at
      // underground content behind/below it), the ray never hits terrain and
      // this returns `undefined` — fall through to the ellipsoid intersection
      // below instead of aborting the whole pick, so callers (e.g. the info
      // box's drill-picker) still get a position to work with and can find
      // underground features via their own, more precise picking.
    }

    const interval = IntersectionTests.rayEllipsoid(ray, Ellipsoid.WGS84);
    if (interval === undefined) {
      return null;
    }
    return Ray.getPoint(ray, interval.start);
  }

  /**
   * Acquire a {@link ScenePickingLock} that, while active, disables the use of `Scene.pickPosition`.
   * This is useful as that method can cause unrecoverable render issues when called
   * while some layers, tiles or other primitives are not yet fully loaded.
   *
   * Note that it's the responsibility of the caller to fully release the lock.
   * When not explicitly releasing a lock, `Scene.pickPosition` will remain unused,
   * possibly leading to inaccurate pick behavior.
   */
  acquireScenePickingLock(): ScenePickingLock {
    this.disableCount += 1;
    let isActive = true;
    return {
      release: (): void => {
        if (isActive) {
          this.disableCount = Math.max(0, this.disableCount - 1);
          isActive = false;
        }
      },
    };
  }
}

/**
 * A lock that, while active, disables accurate picking using the Cesium scene.
 *
 * It is the callers responsibility to ensure that locks are released before they are destroyed.
 *
 * Note that multiple locks can exist at the same time, without influencing each other.
 * Releasing a lock while another remains will leave pick behavior locked.
 */
export interface ScenePickingLock {
  /**
   * Releases the lock, allowing `Scene.pickPosition` to be used.
   *
   * This method may be called multiple times without consequences.
   */
  release(): void;
}
