import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LexicTileLoadWaiter } from './lexic-tile-load';

function createViewerFixture() {
  const progressListeners: Array<(queueLength: number) => void> = [];
  const globe = {
    tilesLoaded: true,
    tileLoadProgressEvent: {
      addEventListener: vi.fn((listener: (queueLength: number) => void) => {
        progressListeners.push(listener);
      }),
      removeEventListener: vi.fn((listener: (queueLength: number) => void) => {
        const index = progressListeners.indexOf(listener);
        if (index >= 0) progressListeners.splice(index, 1);
      }),
    },
  };

  const viewer = {
    scene: {
      globe,
      requestRender: vi.fn(),
    },
  };

  return { viewer, globe, progressListeners };
}

describe('LexicTileLoadWaiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves when tile queue drains after pending work', async () => {
    const waiter = new LexicTileLoadWaiter();
    const { viewer, globe, progressListeners } = createViewerFixture();
    globe.tilesLoaded = false;

    const waitPromise = waiter.wait(viewer as never, { isCurrent: () => true });

    expect(progressListeners).toHaveLength(1);

    progressListeners[0](2);
    globe.tilesLoaded = true;
    progressListeners[0](0);

    await expect(waitPromise).resolves.toBeUndefined();
    expect(globe.tileLoadProgressEvent.removeEventListener).toHaveBeenCalled();
  });

  it('resolves via idle settle when no tile work starts', async () => {
    const waiter = new LexicTileLoadWaiter();
    const { viewer, globe, progressListeners } = createViewerFixture();

    const waitPromise = waiter.wait(viewer as never, { isCurrent: () => true });
    expect(progressListeners).toHaveLength(1);

    await vi.runAllTimersAsync();

    await expect(waitPromise).resolves.toBeUndefined();
    expect(globe.tileLoadProgressEvent.removeEventListener).toHaveBeenCalled();
  });

  it('keeps waiting while tiles are pending and never idle-times out mid-load', async () => {
    const waiter = new LexicTileLoadWaiter();
    const { viewer, globe, progressListeners } = createViewerFixture();
    globe.tilesLoaded = false;

    let hasSettled = false;
    const waitPromise = waiter
      .wait(viewer as never, { isCurrent: () => true })
      .then(() => {
        hasSettled = true;
      });

    progressListeners[0](3);
    await vi.runAllTimersAsync();
    expect(hasSettled).toBe(false);

    globe.tilesLoaded = true;
    progressListeners[0](0);
    await waitPromise;
    expect(hasSettled).toBe(true);
  });

  it('cancels the wait when cancel() is called', async () => {
    const waiter = new LexicTileLoadWaiter();
    const { viewer, globe, progressListeners } = createViewerFixture();
    globe.tilesLoaded = false;

    const waitPromise = waiter.wait(viewer as never, { isCurrent: () => true });
    progressListeners[0](1);

    waiter.cancel();

    await expect(waitPromise).resolves.toBeUndefined();
    expect(globe.tileLoadProgressEvent.removeEventListener).toHaveBeenCalled();
  });

  it('cancels the wait when isCurrent becomes false via progress callback', async () => {
    const waiter = new LexicTileLoadWaiter();
    const { viewer, globe, progressListeners } = createViewerFixture();
    globe.tilesLoaded = false;

    let isCurrent = true;
    const waitPromise = waiter.wait(viewer as never, {
      isCurrent: () => isCurrent,
    });
    isCurrent = false;
    progressListeners[0](1);

    await expect(waitPromise).resolves.toBeUndefined();
  });

  it('returns immediately when globe has no tileLoadProgressEvent', async () => {
    const waiter = new LexicTileLoadWaiter();
    const viewer = {
      scene: {
        globe: {},
        requestRender: vi.fn(),
      },
    };

    await expect(
      waiter.wait(viewer as never, { isCurrent: () => true }),
    ).resolves.toBeUndefined();
  });

  it('returns immediately when isCurrent is already false', async () => {
    const waiter = new LexicTileLoadWaiter();
    const { viewer, progressListeners } = createViewerFixture();

    await expect(
      waiter.wait(viewer as never, { isCurrent: () => false }),
    ).resolves.toBeUndefined();
    expect(progressListeners).toHaveLength(0);
  });
});
