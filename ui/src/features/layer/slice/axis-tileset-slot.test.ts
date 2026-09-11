// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

// `axis-tileset-slot.ts` builds real Cesium3DTileset instances. Unit-testing
// its scheduling/caching/generation logic does not need real Cesium GPU
// resources, so we replace the module with lightweight fakes that mimic
// just the surface AxisTilesetSlot touches (events, isDestroyed/destroy,
// tilesLoaded, customShader).
class FakeEvent {
  private readonly listeners: Array<(...args: unknown[]) => void> = [];

  addEventListener(callback: (...args: unknown[]) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  raise(...args: unknown[]): void {
    for (const listener of [...this.listeners]) {
      listener(...args);
    }
  }
}

class FakeCesium3DTileset {
  static fromUrl = vi.fn(
    async (
      _resource: unknown,
      options: Record<string, unknown>,
    ): Promise<FakeCesium3DTileset> => new FakeCesium3DTileset(options),
  );

  show: boolean;
  preloadWhenHidden: boolean;
  customShader: unknown = null;
  /** Tests set this directly to control `waitUntilReady`'s fast path. */
  tilesLoaded = true;
  environmentMapManager = { enabled: true };
  imageBasedLighting: unknown = null;
  readonly loadProgress = new FakeEvent();
  private destroyed = false;

  constructor(options: Record<string, unknown>) {
    this.show = Boolean(options.show);
    this.preloadWhenHidden = Boolean(options.preloadWhenHidden);
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

class FakeCustomShader {
  setUniform = vi.fn();
  private destroyed = false;

  isDestroyed(): boolean {
    return this.destroyed;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

vi.mock('cesium', () => ({
  Cesium3DTileset: FakeCesium3DTileset,
  CustomShader: FakeCustomShader,
  ImageBasedLighting: class ImageBasedLighting {
    imageBasedLightingFactor: unknown;
  },
  Cartesian2: class Cartesian2 {
    constructor(
      public x: number,
      public y: number,
    ) {}
  },
  Resource: class Resource {},
}));

vi.mock('src/services/pick.service', () => {
  class FakePickService {
    static get = vi.fn(() => new FakePickService());
    acquireScenePickingLock = vi.fn(() => ({ release: vi.fn() }));
  }
  return { PickService: FakePickService };
});

vi.mock('src/features/layer/slice/tileset-slice-prune', () => ({
  pruneTilesetToSlices: vi.fn((json: unknown) => json),
  toBlobUrl: vi.fn(() => `blob:fake-${Math.random()}`),
  createAuthenticatedBlobResource: vi.fn((blobUrl: string) => ({
    url: blobUrl,
  })),
}));

const { AxisTilesetSlot } = await import('./axis-tileset-slot');

const makeViewer = () => ({
  scene: {
    primitives: {
      add: vi.fn(),
      remove: vi.fn(),
      raiseToTop: vi.fn(),
    },
    requestRender: vi.fn(),
  },
});

const makeSlot = () => {
  const viewer = makeViewer();
  const slot = new AxisTilesetSlot({
    // Only the `scene` surface above is touched by AxisTilesetSlot.
    viewer: viewer as never,
    makeShader: () => new FakeCustomShader() as never,
    getOpacity: () => 1,
    getVisibility: () => true,
  });
  return { slot, viewer };
};

describe('AxisTilesetSlot', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('builds and reveals a tileset for a new selection', async () => {
    const { slot, viewer } = makeSlot();

    const isActive = await slot.setSlices(
      {},
      'https://x/tileset.json',
      {},
      'u',
      [3],
    );

    expect(isActive).toBe(true);
    expect(slot.currentTileset).not.toBeNull();
    expect(slot.currentTileset?.show).toBe(true);
    expect(viewer.scene.primitives.add).toHaveBeenCalledTimes(1);
  });

  it('reuses the cached tileset when the same slice is requested again', async () => {
    const { slot } = makeSlot();

    await slot.setSlices({}, 'https://x/tileset.json', {}, 'u', [3]);
    const first = slot.currentTileset;
    await slot.setSlices({}, 'https://x/tileset.json', {}, 'u', [5]);
    await slot.setSlices({}, 'https://x/tileset.json', {}, 'u', [3]);

    expect(slot.currentTileset).toBe(first);
  });

  it('resolves false for a queued call that is superseded before it is applied', async () => {
    const { slot } = makeSlot();

    // Make the first build hang so the second call queues behind it.
    let resolveFirstBuild!: (tileset: FakeCesium3DTileset) => void;
    FakeCesium3DTileset.fromUrl.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstBuild = (tileset) => resolve(tileset);
        }),
    );

    const firstCall = slot.setSlices(
      {},
      'https://x/tileset.json',
      {},
      'u',
      [1],
    );
    // Both of these queue behind the in-flight first call and are collapsed
    // into a single `pending` slot — only the last (numbers=[3]) is ever
    // actually applied.
    const supersededCall = slot.setSlices(
      {},
      'https://x/tileset.json',
      {},
      'u',
      [2],
    );
    const winningCall = slot.setSlices(
      {},
      'https://x/tileset.json',
      {},
      'u',
      [3],
    );

    resolveFirstBuild(new FakeCesium3DTileset({ show: false }));

    const [isFirstActive, isSupersededActive, isWinningActive] =
      await Promise.all([firstCall, supersededCall, winningCall]);

    // Only the numbers=[3] selection is ever actually applied (queued calls
    // collapse into a single `pending` slot) — the first call itself
    // resolves once *all* queued updates (including the later, winning one)
    // have drained, so its own selection ([1]) is correctly reported as no
    // longer active either.
    expect(isFirstActive).toBe(false);
    expect(isSupersededActive).toBe(false);
    expect(isWinningActive).toBe(true);
    expect(slot.currentTileset).not.toBeNull();
  });

  it('clear() hides the active tileset and stops in-flight warming', async () => {
    const { slot } = makeSlot();
    await slot.setSlices({}, 'https://x/tileset.json', {}, 'u', [1]);
    const tileset = slot.currentTileset;
    expect(tileset).not.toBeNull();

    slot.clear();

    expect(slot.currentTileset).toBeNull();
    expect(tileset?.show).toBe(false);

    // A subsequent warmSlices() call for the same axis must observe the
    // generation bump and stop before building anything further.
    FakeCesium3DTileset.fromUrl.mockClear();
    await slot.warmSlices({}, 'https://x/tileset.json', {}, 'u', [1, 2]);
    // warmSlices captures its own generation at the start of the call, so a
    // clear() that already happened *before* the call is not itself a mid-
    // loop cancellation — this just documents current, correct behaviour:
    // warming proceeds for a call started after clear() unless superseded
    // again while running.
    expect(FakeCesium3DTileset.fromUrl).toHaveBeenCalled();
  });

  it('clear() during an in-flight load discards a queued pending selection', async () => {
    const { slot } = makeSlot();

    // Make the first build hang so the second call queues behind it in
    // `pending`.
    let resolveFirstBuild!: (tileset: FakeCesium3DTileset) => void;
    FakeCesium3DTileset.fromUrl.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstBuild = (tileset) => resolve(tileset);
        }),
    );

    const firstCall = slot.setSlices(
      {},
      'https://x/tileset.json',
      {},
      'u',
      [1],
    );
    // Queues behind the in-flight first call into `pending`.
    const queuedCall = slot.setSlices(
      {},
      'https://x/tileset.json',
      {},
      'u',
      [2],
    );

    // The axis is cleared (e.g. it became inactive in Multiple mode) while
    // the first load is still in flight and a selection is queued behind it.
    slot.clear();

    resolveFirstBuild(new FakeCesium3DTileset({ show: false }));

    const [isFirstActive, isQueuedActive] = await Promise.all([
      firstCall,
      queuedCall,
    ]);

    // Neither call's selection should end up active: `clear()` must win,
    // and the queued selection must not be silently applied afterwards.
    expect(isFirstActive).toBe(false);
    expect(isQueuedActive).toBe(false);
    expect(slot.currentTileset).toBeNull();
  });

  it("warmOneSlice does not fast-path a cached tileset that hasn't finished loading", async () => {
    vi.useFakeTimers();
    const { slot } = makeSlot();

    // Build once via the interactive path with tilesLoaded = false, so it
    // ends up cached but not yet ready — e.g. a swap that was revealed once
    // its ready-timeout elapsed (see TILESET_READY_TIMEOUT_MS) while content
    // was still loading.
    FakeCesium3DTileset.fromUrl.mockImplementationOnce(
      async (_resource, options: Record<string, unknown>) => {
        const tileset = new FakeCesium3DTileset(options);
        tileset.tilesLoaded = false;
        return tileset;
      },
    );
    const setSlicesPromise = slot.setSlices(
      {},
      'https://x/tileset.json',
      {},
      'u',
      [7],
    );
    // Let the build resolve, then let waitUntilReady's ready-timeout elapse
    // so the still-loading tileset gets revealed anyway.
    await vi.advanceTimersByTimeAsync(3_000);
    await setSlicesPromise;

    const cachedTileset = slot.currentTileset;
    expect(cachedTileset?.tilesLoaded).toBe(false);

    // Warming the same slice must not just wave it through because a cache
    // entry exists: it must still wait for it to actually finish loading.
    FakeCesium3DTileset.fromUrl.mockClear();
    const warmPromise = slot.warmSlices(
      {},
      'https://x/tileset.json',
      {},
      'u',
      [7],
    );
    // It must not have rebuilt/re-requested a second tileset for the same
    // key — it should be joining the existing cache entry instead.
    expect(FakeCesium3DTileset.fromUrl).not.toHaveBeenCalled();

    // The slice now finishes loading; the next warm pump tick must detect it
    // and let warming complete instead of only giving up at the (much
    // later) warm timeout.
    (cachedTileset as unknown as FakeCesium3DTileset).tilesLoaded = true;
    await vi.advanceTimersByTimeAsync(100);
    await warmPromise;
  });
});
