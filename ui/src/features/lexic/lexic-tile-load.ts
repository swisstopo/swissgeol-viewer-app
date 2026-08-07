import type { Viewer } from 'cesium';

export interface LexicTileLoadWaitOptions {
  /** Returns false when a newer update supersedes this wait. */
  isCurrent: () => boolean;
}

/**
 * Waits for Cesium to finish (or skip) the initial imagery tile load after a
 * filtered layer is added to the viewer.
 */
export class LexicTileLoadWaiter {
  private finishCurrent: (() => void) | null = null;

  /**
   * Completes when pending tiles drain, a short idle settle finds no work,
   * or {@link cancel} is called.
   */
  async wait(
    viewer: Viewer,
    { isCurrent }: LexicTileLoadWaitOptions,
  ): Promise<void> {
    if (!isCurrent()) return;

    const globe = viewer.scene.globe;
    if (globe == null) return;

    const progressEvent = globe.tileLoadProgressEvent;
    if (typeof progressEvent?.addEventListener !== 'function') return;

    this.cancel();

    await new Promise<void>((resolve) => {
      let hasSeenPendingTiles = false;
      let idleTimer: ReturnType<typeof setTimeout> | null = null;

      const finish = () => {
        if (this.finishCurrent !== finish) return;
        this.finishCurrent = null;
        if (idleTimer != null) clearTimeout(idleTimer);
        progressEvent.removeEventListener(onProgress);
        resolve();
      };

      const onProgress = (queueLength: number) => {
        if (!isCurrent()) {
          finish();
          return;
        }
        if (queueLength > 0) {
          hasSeenPendingTiles = true;
          if (idleTimer != null) {
            clearTimeout(idleTimer);
            idleTimer = null;
          }
        }
        if (hasSeenPendingTiles && queueLength === 0 && globe.tilesLoaded) {
          finish();
        }
      };

      this.finishCurrent = finish;
      progressEvent.addEventListener(onProgress);
      viewer.scene.requestRender();

      // If no tile work starts shortly (cached / empty), do not hang forever.
      // Once pending tiles are observed, the idle timer is cleared and we wait
      // until the queue drains — there is no hard cancel mid-load.
      idleTimer = setTimeout(() => {
        idleTimer = null;
        if (!hasSeenPendingTiles) finish();
      }, 100);
    });
  }

  /** Cancels any in-flight wait and resolves its promise. */
  cancel(): void {
    this.finishCurrent?.();
  }
}
