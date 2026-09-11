import {
  Cartesian2,
  Cesium3DTileset,
  CustomShader,
  ImageBasedLighting,
  Resource,
  Viewer,
} from 'cesium';
import { PickService, ScenePickingLock } from 'src/services/pick.service';
import { OgcSliceDirection } from 'src/features/layer/slice/tiles3d-slice.types';
import {
  createAuthenticatedBlobResource,
  pruneTilesetToSlices,
  toBlobUrl,
} from 'src/features/layer/slice/tileset-slice-prune';

const TILESET_OPTIONS = {
  backFaceCulling: false,
  enableCollision: false,
  maximumScreenSpaceError: 16,
  cullWithChildrenBounds: true,
  cullRequestsWhileMoving: true,
  cullRequestsWhileMovingMultiplier: 100,
  // Required for seamless swaps: load the next slice while it is still hidden.
  preloadWhenHidden: true,
  preferLeaves: true,
  // Slice tilesets are a handful of textured quads. The foveated/dynamic SSE
  // heuristics only defer their requests (foveatedTimeDelay in particular waits
  // for the camera to settle), which directly delays slider swaps.
  dynamicScreenSpaceError: false,
  foveatedScreenSpaceError: false,
  // Slices are unlit textured quads with a custom shader, so the specular
  // environment map (a per-tileset cubemap baked over several frames via
  // deferred ComputeCommands) is both wasted work and actively dangerous
  // here: we create/destroy dozens of these tilesets in quick succession
  // (warming/eviction/superseding), and destroying a tileset before its
  // environment map finishes baking leaves those queued compute commands
  // writing into an already-deleted texture ("attempt to use a deleted
  // object" / "Framebuffer is incomplete").
  environmentMapOptions: { enabled: false },
} as const;

/**
 * Keep recently used slice tilesets so scrubbing back is instant.
 * Must comfortably exceed `SLICE_GPU_WARM_RADIUS * 2` so warming does not
 * immediately evict its own entries. Each entry holds a decoded slice texture
 * in GPU memory, so this is a direct VRAM/responsiveness trade-off (× 3 axes).
 */
const MAX_CACHED_TILESETS = 16;

/**
 * Cap how long we wait for content before revealing anyway.
 *
 * The previous slice stays visible for the whole wait (see `revealTileset`),
 * so there is no "blocking" downside to waiting here — only the upside of
 * not revealing an empty tileset. Under concurrent load (fast scrubbing plus
 * background warming on 3 axes), even the very first tile can take well over
 * a few hundred ms to fetch/parse/upload; a too-short cap made the swap
 * reveal a completely empty tileset instead of the still-loading previous
 * one, i.e. a visible blank flash. Kept well below `TILESET_WARM_TIMEOUT_MS`
 * since this still guards against a genuinely stuck request.
 */
const TILESET_READY_TIMEOUT_MS = 3_000;

/**
 * Background warming is off the interaction path, so it may wait much longer.
 * Giving up early would leave the slice only partially loaded and defeat the
 * point of warming it.
 */
const TILESET_WARM_TIMEOUT_MS = 30_000;

/**
 * Warming still needs frames to be rendered for Cesium to traverse a hidden
 * tileset, but it must not hold the viewer at full frame rate for the whole
 * warm-up. A slow pump is enough to keep tile requests flowing.
 */
const WARM_PUMP_INTERVAL_MS = 100;

export interface AxisTilesetSlotOptions {
  viewer: Viewer;
  makeShader: () => CustomShader;
  getOpacity: () => number;
  getVisibility: () => boolean;
}

interface CachedTileset {
  tileset: Cesium3DTileset;
  blobUrl: string;
  /** Releases the scene picking lock held while this tileset loads. */
  releasePickLock?: () => void;
}

/**
 * Owns Cesium3DTilesets for one seismic axis (U / V / W).
 * Recently used slice selections are kept in an LRU cache so slider scrubbing
 * does not rebuild the same tileset repeatedly.
 *
 * Slice swaps are double-buffered: the previous tileset stays visible until the
 * next one is ready, then they swap atomically to avoid a blank flash.
 */
export class AxisTilesetSlot {
  private tileset: Cesium3DTileset | null = null;
  private activeKey: string | null = null;
  private readonly cache = new Map<string, CachedTileset>();
  private readonly cacheOrder: string[] = [];
  private scenePickingLock: ScenePickingLock | null = null;
  private isUpdating = false;
  /** Bumped whenever a new selection arrives, cancelling in-flight warming. */
  private warmGeneration = 0;
  /** Reused across tilesets so a slice swap does not recompile the shader. */
  private sharedShader: CustomShader | null = null;
  private sharedShaderIsOpaque = true;
  /** Bumped on every setSlices attempt so superseded loads are not revealed. */
  private loadGeneration = 0;
  private isDestroyed = false;
  private pending: {
    originalJson: unknown;
    baseUrl: string;
    headers: Record<string, string>;
    direction: OgcSliceDirection;
    numbers: number[];
  } | null = null;
  /**
   * Queued callers waiting for their own `setSlices()` call to be applied.
   * Each entry remembers the key the caller asked for so it can be told,
   * once the queue drains, whether *its* selection ended up active or was
   * itself superseded by a later call before ever being applied — callers
   * (e.g. neighbourhood prefetch/warming) must not act on a stale center.
   */
  private readonly pendingResolvers: Array<{
    resolve: (isActive: boolean) => void;
    key: string | null;
  }> = [];
  /**
   * Tracks tileset builds in progress, keyed the same way as `cache`. Both
   * the interactive swap path and background warming can want the same slice
   * at once; without this, both would build and add their own tileset for
   * that key, and the loser would linger in `scene.primitives` outside the
   * cache — never re-pointed when the shared shader is later rebuilt, later
   * crashing an unrelated render with "This object was destroyed".
   */
  private readonly inFlightBuilds = new Map<string, Promise<CachedTileset>>();

  constructor(private readonly options: AxisTilesetSlotOptions) {}

  get currentTileset(): Cesium3DTileset | null {
    return this.tileset;
  }

  /**
   * Selects the slice(s) shown on this axis.
   *
   * Resolves to `true` if this call's own selection is the one that ended up
   * active on this axis, or `false` if it was itself superseded by a later
   * call before ever being (or while being) applied. Callers that act on the
   * *result* of a selection (e.g. prioritizing/warming the neighbourhood
   * around the newly selected slice) must skip that follow-up work when this
   * resolves `false`, since the center they have is no longer current.
   */
  async setSlices(
    originalJson: unknown,
    baseUrl: string,
    headers: Record<string, string>,
    direction: OgcSliceDirection,
    numbers: number[],
  ): Promise<boolean> {
    // A new selection wins over any background warming.
    this.warmGeneration += 1;

    // `numbers.length === 0` clears the axis, i.e. leaves `activeKey` `null`
    // (see `performSetSlices`/`clear`) — use `null` here too so comparisons
    // against `this.activeKey` below correctly recognise "this call's own
    // (empty) selection is the one that is currently active".
    const key =
      numbers.length === 0 ? null : `${direction}:${numbers.join(',')}`;

    // Fast path: if the target slice is already loaded, swap synchronously.
    // This must bypass the update queue entirely — otherwise a warmed slice
    // would still be held back behind an in-flight load of a slice the user
    // has already scrubbed past.
    if (this.tryRevealLoaded(direction, numbers)) {
      return true;
    }

    if (this.isUpdating) {
      this.pending = { originalJson, baseUrl, headers, direction, numbers };
      // Resolve only once the queued selection has actually been applied, so
      // callers do not start warming a neighbourhood that is already stale.
      return new Promise<boolean>((resolve) => {
        this.pendingResolvers.push({ resolve, key });
      });
    }

    this.isUpdating = true;
    try {
      await this.performSetSlices(
        originalJson,
        baseUrl,
        headers,
        direction,
        numbers,
      );
      while (this.pending !== null) {
        const next = this.pending;
        this.pending = null;
        await this.performSetSlices(
          next.originalJson,
          next.baseUrl,
          next.headers,
          next.direction,
          next.numbers,
        );
      }
    } finally {
      this.isUpdating = false;
      for (const { resolve, key: pendingKey } of this.pendingResolvers.splice(
        0,
      )) {
        resolve(pendingKey === this.activeKey);
      }
    }
    return key === this.activeKey;
  }

  /**
   * Build and fully load hidden tilesets for `numbers` (one slice each) so a
   * later swap to any of them is a pure `show` flip.
   *
   * This is the part that actually makes scrubbing instant: warming only the
   * HTTP cache still leaves glTF parsing, texture decoding and GPU upload to be
   * done at swap time, which is the dominant cost.
   *
   * Runs one slice at a time, yields between slices, and is cancelled as soon
   * as a new selection arrives.
   */
  async warmSlices(
    originalJson: unknown,
    baseUrl: string,
    headers: Record<string, string>,
    direction: OgcSliceDirection,
    numbers: readonly number[],
  ): Promise<void> {
    const generation = ++this.warmGeneration;

    for (const number of numbers) {
      if (generation !== this.warmGeneration) {
        return;
      }
      const shouldContinue = await this.warmOneSlice(
        generation,
        originalJson,
        baseUrl,
        headers,
        direction,
        number,
      );
      if (!shouldContinue) {
        return;
      }
    }
  }

  /**
   * Warm a single slice. Returns `true` to continue to the next slice, or
   * `false` to abort warming entirely (generation superseded or update in
   * flight).
   */
  private async warmOneSlice(
    generation: number,
    originalJson: unknown,
    baseUrl: string,
    headers: Record<string, string>,
    direction: OgcSliceDirection,
    number: number,
  ): Promise<boolean> {
    const key = `${direction}:${number}`;
    const existing = this.cache.get(key);
    if (
      existing !== undefined &&
      !existing.tileset.isDestroyed() &&
      existing.tileset.tilesLoaded
    ) {
      return true;
    }
    if (this.isUpdating) {
      // Never compete with a user-driven swap.
      return false;
    }

    let created: CachedTileset;
    try {
      created = await this.buildOrJoinTileset(
        key,
        originalJson,
        baseUrl,
        headers,
        direction,
        [number],
      );
    } catch (error) {
      console.warn(`Failed to warm slice ${direction}:${number}:`, error);
      return true;
    }

    if (generation !== this.warmGeneration) {
      // A newer selection arrived while building. The tileset is already
      // cached (possibly by/for the interactive path too), so just make
      // sure it stops traversing rather than destroying it outright.
      freezeHiddenIfNotActive(this.tileset, created.tileset);
      return false;
    }

    await this.waitUntilReady(
      created.tileset,
      TILESET_WARM_TIMEOUT_MS,
      WARM_PUMP_INTERVAL_MS,
    );
    // A swap may have revealed this very tileset while we were waiting —
    // freezing it then would hide the selected plane.
    freezeHiddenIfNotActive(this.tileset, created.tileset);
    return true;
  }

  /**
   * Synchronously reveal a slice whose tileset is already built and loaded.
   *
   * Returns false if the slice still needs loading, in which case the caller
   * falls back to the queued async path.
   */
  private tryRevealLoaded(
    direction: OgcSliceDirection,
    numbers: readonly number[],
  ): boolean {
    if (numbers.length === 0) {
      return false;
    }
    const key = `${direction}:${numbers.join(',')}`;

    if (
      key === this.activeKey &&
      this.tileset !== null &&
      !this.tileset.isDestroyed()
    ) {
      this.supersedeInFlight();
      this.tileset.show = this.options.getVisibility();
      this.options.viewer.scene.requestRender();
      return true;
    }

    const cached = this.cache.get(key);
    if (
      cached === undefined ||
      cached.tileset.isDestroyed() ||
      !cached.tileset.tilesLoaded
    ) {
      return false;
    }

    this.supersedeInFlight();
    this.touchCache(key);
    this.revealTileset(key, cached.tileset, this.tileset);
    return true;
  }

  /**
   * Invalidate any in-flight or queued load: this selection is newer, and the
   * slice it wants is already on screen.
   */
  private supersedeInFlight(): void {
    this.loadGeneration += 1;
    this.pending = null;
  }

  /** Hide this axis without destroying (used in Multiple mode for inactive axes). */
  clear(): void {
    this.loadGeneration += 1;
    // Also stop any in-flight background warming for this axis — otherwise a
    // still-running `warmSlices()` loop keeps requesting/building tilesets
    // for an axis that is no longer shown.
    this.warmGeneration += 1;
    // Drop any selection queued behind an in-flight load. Without this, the
    // queue-draining loop in `setSlices()` would still apply it once the
    // current (now-superseded) load finishes, reactivating this axis right
    // after `clear()` asked for it to stay hidden.
    this.pending = null;
    if (this.tileset !== null) {
      freezeHidden(this.tileset);
    }
    this.tileset = null;
    this.activeKey = null;
  }

  setOpacity(opacity: number): void {
    const shader = this.getShader();
    shader.setUniform('u_alpha', opacity);
    if (this.tileset !== null && this.tileset.customShader !== shader) {
      this.tileset.customShader = shader;
    }
    this.options.viewer.scene.requestRender();
  }

  setVisible(isVisible: boolean): void {
    if (this.tileset === null) {
      return;
    }
    if (isVisible) {
      this.tileset.preloadWhenHidden = true;
      this.tileset.show = true;
    } else {
      freezeHidden(this.tileset);
    }
    this.options.viewer.scene.requestRender();
  }

  raiseToTop(): void {
    if (this.tileset !== null) {
      this.options.viewer.scene.primitives.raiseToTop(this.tileset);
    }
  }

  destroy(): void {
    this.destroyAll();
  }

  private async performSetSlices(
    originalJson: unknown,
    baseUrl: string,
    headers: Record<string, string>,
    direction: OgcSliceDirection,
    numbers: number[],
  ): Promise<void> {
    const generation = ++this.loadGeneration;

    if (numbers.length === 0) {
      this.clear();
      return;
    }

    const key = `${direction}:${numbers.join(',')}`;
    if (key === this.activeKey && this.tileset !== null) {
      this.tileset.show = this.options.getVisibility();
      return;
    }

    const previous = this.tileset;

    const cached = this.cache.get(key);
    if (cached !== undefined && !cached.tileset.isDestroyed()) {
      await this.revealCachedTileset(key, cached, previous, generation);
      return;
    }

    let created: CachedTileset;
    try {
      created = await this.buildOrJoinTileset(
        key,
        originalJson,
        baseUrl,
        headers,
        direction,
        numbers,
      );
    } catch (error) {
      console.warn(
        `Failed to build tileset for direction ${direction}:`,
        error,
      );
      if (!this.isSuperseded(generation)) {
        this.clear();
      }
      return;
    }

    const { tileset } = created;
    if (this.isSuperseded(generation)) {
      // Do not reveal, and do not let it keep traversing in the background —
      // a newer selection already won. It stays cached for later scrubbing.
      freezeHidden(tileset);
      return;
    }

    await this.waitUntilReady(tileset);
    if (this.isRevealSuperseded(generation)) {
      freezeHidden(tileset);
      return;
    }

    this.revealTileset(key, tileset, previous);
  }

  private async revealCachedTileset(
    key: string,
    cached: CachedTileset,
    previous: Cesium3DTileset | null,
    generation: number,
  ): Promise<void> {
    this.touchCache(key);
    if (this.isSuperseded(generation)) {
      return;
    }
    if (!cached.tileset.tilesLoaded) {
      // Frozen cache entries do not traverse; re-enable before waiting.
      cached.tileset.preloadWhenHidden = true;
      await this.waitUntilReady(cached.tileset);
      if (this.isRevealSuperseded(generation)) {
        freezeHidden(cached.tileset);
        return;
      }
    }
    this.revealTileset(key, cached.tileset, previous);
  }

  /**
   * Add a freshly built tileset to the scene and the LRU cache, holding a
   * scene picking lock until its content has loaded.
   */
  private addToScene(key: string, entry: CachedTileset): void {
    this.applyAppearance(entry.tileset);
    this.options.viewer.scene.primitives.add(entry.tileset);
    entry.releasePickLock = this.attachPickLock(entry.tileset);
    this.rememberCache(key, entry);
  }

  /**
   * Atomically show the next tileset and hide the previous one.
   */
  private revealTileset(
    key: string,
    next: Cesium3DTileset,
    previous: Cesium3DTileset | null,
  ): void {
    this.applyAppearance(next);
    next.preloadWhenHidden = true;
    next.show = this.options.getVisibility();
    this.options.viewer.scene.primitives.raiseToTop(next);

    if (previous !== null && previous !== next && !previous.isDestroyed()) {
      // Stop the demoted tileset from traversing and requesting every frame.
      // Its already-loaded content stays resident, so scrubbing back is instant.
      freezeHidden(previous);
    }

    this.tileset = next;
    this.activeKey = key;
    this.options.viewer.scene.requestRender();
  }

  private isSuperseded(generation: number): boolean {
    return generation !== this.loadGeneration || this.pending !== null;
  }

  /**
   * Whether a finished load should still be revealed.
   *
   * Deliberately ignores `pending`: a queued selection means the user is still
   * scrubbing, and showing this slice is a useful intermediate frame that will
   * be replaced a moment later. Suppressing it is what made a fast drag look
   * frozen until the user let go. Only a newer load or a synchronous reveal
   * (both of which bump `loadGeneration`) cancels the reveal.
   */
  private isRevealSuperseded(generation: number): boolean {
    return generation !== this.loadGeneration;
  }

  /**
   * Wait until the tileset has finished its initial content load (or timeout).
   *
   * The viewer runs with `requestRenderMode`, and the tileset is added with
   * `show: false`. Without an explicit render pump, no further frames are
   * scheduled, the hidden tileset is never traversed, `loadProgress` never
   * settles and every swap blocks for the full timeout. So we drive a frame per
   * animation frame until the load settles.
   */
  private async waitUntilReady(
    tileset: Cesium3DTileset,
    timeoutMs: number = TILESET_READY_TIMEOUT_MS,
    pumpIntervalMs = 0,
  ): Promise<void> {
    if (tileset.tilesLoaded) {
      return;
    }

    await new Promise<void>((resolve) => {
      let hasSettled = false;
      let frameId = 0;
      let pumpTimeoutId = 0;

      const finish = (): void => {
        if (hasSettled) {
          return;
        }
        hasSettled = true;
        window.clearTimeout(timeoutId);
        window.clearTimeout(pumpTimeoutId);
        window.cancelAnimationFrame(frameId);
        removeListener();
        resolve();
      };

      const removeListener = tileset.loadProgress.addEventListener(
        (pending: number, processing: number) => {
          if (pending === 0 && processing === 0) {
            finish();
          }
        },
      );

      const timeoutId = window.setTimeout(finish, timeoutMs);

      const scheduleNextPump = (): void => {
        if (pumpIntervalMs > 0) {
          pumpTimeoutId = window.setTimeout(pump, pumpIntervalMs);
        } else {
          frameId = window.requestAnimationFrame(pump);
        }
      };

      const pump = (): void => {
        if (hasSettled || tileset.isDestroyed() || tileset.tilesLoaded) {
          finish();
          return;
        }
        this.options.viewer.scene.requestRender();
        scheduleNextPump();
      };
      pump();
    });
  }

  private applyAppearance(tileset: Cesium3DTileset): void {
    const shader = this.getShader();
    if (tileset.customShader !== shader) {
      tileset.customShader = shader;
    }
  }

  /**
   * One CustomShader instance is shared by every tileset of this axis, so a
   * slice swap never triggers a GLSL compile/link. It is only rebuilt when the
   * opaque/translucent mode flips, since that changes the generated source.
   */
  private getShader(): CustomShader {
    const opacity = this.options.getOpacity();
    const isOpaque = opacity === 1;
    if (this.sharedShader === null || this.sharedShaderIsOpaque !== isOpaque) {
      const previousShader = this.sharedShader;
      this.sharedShader = this.options.makeShader();
      this.sharedShaderIsOpaque = isOpaque;
      // Re-point every live tileset before disposing the replaced shader,
      // otherwise they would reference destroyed GPU resources.
      for (const entry of this.cache.values()) {
        if (!entry.tileset.isDestroyed()) {
          entry.tileset.customShader = this.sharedShader;
        }
      }
      destroyShader(previousShader);
    }
    this.sharedShader.setUniform('u_alpha', opacity);
    return this.sharedShader;
  }

  private rememberCache(key: string, entry: CachedTileset): void {
    this.cache.set(key, entry);
    this.touchCache(key);
    while (this.cacheOrder.length > MAX_CACHED_TILESETS) {
      const evictKey = this.cacheOrder.find(
        (candidate) => candidate !== key && candidate !== this.activeKey,
      );
      if (evictKey === undefined) {
        break;
      }
      this.evictCacheKey(evictKey);
    }
  }

  private touchCache(key: string): void {
    const index = this.cacheOrder.indexOf(key);
    if (index >= 0) {
      this.cacheOrder.splice(index, 1);
    }
    this.cacheOrder.push(key);
  }

  private evictCacheKey(key: string): void {
    const entry = this.cache.get(key);
    if (entry === undefined) {
      return;
    }
    this.cache.delete(key);
    const orderIndex = this.cacheOrder.indexOf(key);
    if (orderIndex >= 0) {
      this.cacheOrder.splice(orderIndex, 1);
    }
    this.destroyCachedTileset(entry);
    if (this.activeKey === key) {
      this.tileset = null;
      this.activeKey = null;
    }
  }

  private async loadTileset(
    resource: Resource,
    show: boolean,
  ): Promise<Cesium3DTileset> {
    const tileset = await Cesium3DTileset.fromUrl(resource, {
      ...TILESET_OPTIONS,
      show,
    });
    // Belt-and-braces: ensure it's off even if `environmentMapOptions` isn't
    // honored by this Cesium version's `fromUrl` (see `TILESET_OPTIONS`).
    tileset.environmentMapManager.enabled = false;
    tileset.imageBasedLighting = new ImageBasedLighting();
    tileset.imageBasedLighting.imageBasedLightingFactor = new Cartesian2(1, 0);
    return tileset;
  }

  /**
   * Build a hidden tileset restricted to `numbers`. Not added to the scene yet
   * so the caller can discard it if the selection changed meanwhile.
   */
  private async createTileset(
    originalJson: unknown,
    baseUrl: string,
    headers: Record<string, string>,
    direction: OgcSliceDirection,
    numbers: readonly number[],
  ): Promise<CachedTileset> {
    const pruned = pruneTilesetToSlices(
      originalJson,
      { direction, numbers: new Set(numbers) },
      baseUrl,
    );
    const blobUrl = toBlobUrl(pruned);
    const resource = createAuthenticatedBlobResource(blobUrl, headers);
    try {
      const tileset = await this.loadTileset(resource, false);
      return { tileset, blobUrl };
    } catch (error) {
      URL.revokeObjectURL(blobUrl);
      throw error;
    }
  }

  private destroyCachedTileset(entry: CachedTileset): void {
    entry.releasePickLock?.();
    entry.releasePickLock = undefined;
    this.options.viewer.scene.primitives.remove(entry.tileset);
    if (!entry.tileset.isDestroyed()) {
      entry.tileset.destroy();
    }
    URL.revokeObjectURL(entry.blobUrl);
  }

  /**
   * Builds the tileset for `key`, or joins an already in-flight build for it,
   * ensuring it is added to the scene/cache exactly once. Both the
   * interactive swap and background warming call this so a slider landing on
   * a slice that is already being warmed does not race to build/add it
   * twice — see the `inFlightBuilds` doc comment for why that duplication is
   * unsafe.
   */
  private buildOrJoinTileset(
    key: string,
    originalJson: unknown,
    baseUrl: string,
    headers: Record<string, string>,
    direction: OgcSliceDirection,
    numbers: readonly number[],
  ): Promise<CachedTileset> {
    const cached = this.cache.get(key);
    if (cached !== undefined && !cached.tileset.isDestroyed()) {
      return Promise.resolve(cached);
    }

    const inFlight = this.inFlightBuilds.get(key);
    if (inFlight !== undefined) {
      return inFlight;
    }

    const build = this.createTileset(
      originalJson,
      baseUrl,
      headers,
      direction,
      numbers,
    )
      .then((created) => {
        // Another caller may have finished and cached this key while we were
        // awaiting network/parse work — never add a second copy to the scene.
        const winner = this.cache.get(key);
        if (winner !== undefined && !winner.tileset.isDestroyed()) {
          this.destroyCachedTileset(created);
          return winner;
        }
        if (this.isDestroyed) {
          this.destroyCachedTileset(created);
          throw new Error('AxisTilesetSlot destroyed during tileset build');
        }
        this.addToScene(key, created);
        return created;
      })
      .finally(() => {
        if (this.inFlightBuilds.get(key) === build) {
          this.inFlightBuilds.delete(key);
        }
      });

    this.inFlightBuilds.set(key, build);
    return build;
  }

  private attachPickLock(tileset: Cesium3DTileset): () => void {
    const pickService = PickService.get();
    // Locks are tracked per tileset: several slice tilesets can be loading at
    // once, and a shared field would leak a lock and disable picking for good.
    let lock: ScenePickingLock | null = pickService.acquireScenePickingLock();
    const removeListener = tileset.loadProgress.addEventListener(
      (numberOfPendingRequests: number, numberOfTilesProcessing: number) => {
        if (numberOfPendingRequests === 0 && numberOfTilesProcessing === 0) {
          lock?.release();
          lock = null;
        } else {
          lock ??= pickService.acquireScenePickingLock();
        }
      },
    );
    return () => {
      removeListener();
      lock?.release();
      lock = null;
    };
  }

  private destroyAll(): void {
    this.isDestroyed = true;
    this.loadGeneration += 1;
    this.warmGeneration += 1;
    this.scenePickingLock?.release();
    this.scenePickingLock = null;
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      this.evictCacheKey(key);
    }
    this.tileset = null;
    this.activeKey = null;
    destroyShader(this.sharedShader);
    this.sharedShader = null;
  }
}

/** Cesium does not dispose a tileset's `customShader`, so we own its lifetime. */
const destroyShader = (shader: CustomShader | null): void => {
  if (shader !== null && !shader.isDestroyed()) {
    shader.destroy();
  }
};

/**
 * Hide a tileset and stop it from traversing / requesting tiles every frame.
 * Already-loaded content stays resident, so re-showing it is instant.
 */
const freezeHidden = (tileset: Cesium3DTileset): void => {
  tileset.show = false;
  tileset.preloadWhenHidden = false;
};

/** Freeze `tileset` only if it is not the currently active one. */
const freezeHiddenIfNotActive = (
  active: Cesium3DTileset | null,
  tileset: Cesium3DTileset,
): void => {
  if (active !== tileset && !tileset.isDestroyed()) {
    freezeHidden(tileset);
  }
};

export { TILESET_OPTIONS };
