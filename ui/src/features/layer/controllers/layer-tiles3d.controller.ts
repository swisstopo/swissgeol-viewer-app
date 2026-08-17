import { BehaviorSubject, Observable } from 'rxjs';
import {
  BaseLayerController,
  mapLayerSourceToResource,
} from 'src/features/layer/controllers/layer.controller';
import { LayerSourceType, LayerType, Tiles3dLayer } from 'src/features/layer';
import { LayerService } from 'src/features/layer/layer.service';
import {
  BoundingSphere,
  Cartesian2,
  Cesium3DTileset,
  CustomShader,
  CustomShaderTranslucencyMode,
  ImageBasedLighting,
  Resource,
  UniformType,
} from 'cesium';
import { OBJECT_HIGHLIGHT_NORMALIZED_RGB } from 'src/constants';
import { PickService, ScenePickingLock } from 'src/services/pick.service';
import {
  AXIS_TO_DIRECTION,
  AxisTilesetSlot,
  absolutizeTilesetUris,
  collectAxisSliceUriMap,
  createAuthenticatedBlobResource,
  createDefaultSliceSelection,
  emptySlicePreloadProgress,
  evenlySpacedSliceNumbers,
  extractResourceHeaders,
  hasSliceMetadata,
  neighborhoodSliceNumbers,
  orderNumbersFromCenter,
  parseTilesetSliceMetadata,
  resolveOgcTilesetResource,
  ResolvedTileset,
  SEISMIC_SLICE_AXES,
  SeismicSliceAxis,
  SLICE_GPU_WARM_RADIUS,
  SLICE_PREFETCH_RADIUS,
  SlicePreloadProgress,
  SlicePreloadQueue,
  Tiles3dSliceSelection,
  TilesetSliceMetadata,
  toBlobUrl,
} from 'src/features/layer/slice';

export class Tiles3dLayerController extends BaseLayerController<Tiles3dLayer> {
  private _tileset!: Cesium3DTileset;
  private scenePickingLock: ScenePickingLock | null = null;

  private originalTilesetJson: unknown = null;
  private baseUrl = '';
  private resourceHeaders: Record<string, string> = {};
  private sliceMetadata: TilesetSliceMetadata | null = null;
  private defaultSliceSelection: Tiles3dSliceSelection | null = null;
  private readonly axisSlots = new Map<SeismicSliceAxis, AxisTilesetSlot>();
  /** JSON-serialized slice numbers last applied per axis (skip unchanged rebuilds). */
  private readonly appliedNumbersByAxis = new Map<SeismicSliceAxis, string>();
  private preloadQueue: SlicePreloadQueue | null = null;
  /** Bumped on every `zoomIntoView()` call so a superseded background refinement fly is dropped. */
  private zoomGeneration = 0;
  /**
   * Background prefetching (warming the HTTP cache / building neighbouring
   * GPU tilesets for every axis) is only useful while the slice HUD panel
   * (with its sliders) is actually open — that's the only place slices are
   * scrubbed through quickly. Toggled by `setHudActive` from the panel's
   * connect/disconnect lifecycle; gates `startAxisPreload`,
   * `prioritizeAxisNeighborhood` and `warmAxisNeighborhood` below.
   */
  private isHudActive = false;
  /** Memoized `slice number -> content URI` per axis (walking the tileset JSON
   * is O(nodes) and used to run on every slider input event). */
  private readonly uriMapByAxis = new Map<
    SeismicSliceAxis,
    Map<number, string>
  >();
  private readonly preloadProgress$ = new BehaviorSubject<SlicePreloadProgress>(
    emptySlicePreloadProgress(),
  );

  get type(): LayerType.Tiles3d {
    return LayerType.Tiles3d;
  }

  get tileset(): Cesium3DTileset {
    for (const axis of SEISMIC_SLICE_AXES) {
      const slotTileset = this.axisSlots.get(axis)?.currentTileset;
      if (slotTileset !== null && slotTileset !== undefined) {
        return slotTileset;
      }
    }
    return this._tileset;
  }

  get tilesets(): Cesium3DTileset[] {
    const axisTs: Cesium3DTileset[] = [];
    for (const axis of SEISMIC_SLICE_AXES) {
      const slotTileset = this.axisSlots.get(axis)?.currentTileset;
      if (slotTileset !== null && slotTileset !== undefined) {
        axisTs.push(slotTileset);
      }
    }
    if (axisTs.length > 0) {
      return axisTs;
    }
    return this._tileset !== undefined ? [this._tileset] : [];
  }

  get supportsSliceSelection(): boolean {
    return hasSliceMetadata(this.sliceMetadata);
  }

  getSliceMetadata(): TilesetSliceMetadata | null {
    return this.sliceMetadata;
  }

  getDefaultSliceSelection(): Tiles3dSliceSelection | null {
    return this.defaultSliceSelection;
  }

  getAxisNumbers(axis: SeismicSliceAxis): number[] {
    return this.sliceMetadata?.axes[axis]?.numbers ?? [];
  }

  get preloadProgress(): Observable<SlicePreloadProgress> {
    return this.preloadProgress$.asObservable();
  }

  getPreloadProgress(): SlicePreloadProgress {
    return this.preloadProgress$.value;
  }

  /**
   * Enable or disable background slice prefetching. Called by the slice HUD
   * panel from its connect/disconnect lifecycle, so prefetching only runs
   * while the panel (with its sliders) is actually open, instead of eagerly
   * warming every slice as soon as the layer is activated.
   */
  setHudActive(active: boolean): void {
    if (this.isHudActive === active) {
      return;
    }
    this.isHudActive = active;
    if (active) {
      this.startAxisPreload();
    } else {
      this.pausePreload();
    }
  }

  /**
   * Warm the HTTP cache for every slice GLB on each axis (center-out from the
   * current selection). Safe to call repeatedly; already-queued URLs are skipped.
   * No-op while the slice HUD panel isn't open (see `setHudActive`).
   */
  startAxisPreload(
    selection: Tiles3dSliceSelection | null = this.layer.sliceSelection,
  ): void {
    if (
      !this.isHudActive ||
      this.originalTilesetJson === null ||
      !this.supportsSliceSelection ||
      this.sliceMetadata === null
    ) {
      return;
    }

    this.ensurePreloadQueue();
    const centers = selection?.single ?? this.defaultSliceSelection?.single;

    for (const axis of SEISMIC_SLICE_AXES) {
      const available = this.getAxisNumbers(axis);
      if (available.length === 0) {
        continue;
      }
      const uriByNumber = this.getAxisUriMap(axis);
      const center =
        centers?.[axis] ?? available[Math.floor(available.length / 2)];
      const ordered = orderNumbersFromCenter(available, center);
      const urls = ordered
        .map((number) => uriByNumber.get(number))
        .filter((url): url is string => url !== undefined);
      this.preloadQueue!.enqueue(axis, urls, false);
    }
  }

  /** Lazily built and cached; the tileset JSON never changes after load. */
  private getAxisUriMap(axis: SeismicSliceAxis): Map<number, string> {
    let map = this.uriMapByAxis.get(axis);
    if (map === undefined) {
      map = collectAxisSliceUriMap(
        this.originalTilesetJson,
        AXIS_TO_DIRECTION[axis],
        this.baseUrl,
      );
      this.uriMapByAxis.set(axis, map);
    }
    return map;
  }

  /**
   * Bump nearby slices for one axis to the front of the preload queue so
   * scrubbing stays responsive while the full-axis warm-up continues.
   * No-op while the slice HUD panel isn't open (see `setHudActive`).
   */
  prioritizeAxisNeighborhood(
    axis: SeismicSliceAxis,
    center: number,
    radius: number = SLICE_PREFETCH_RADIUS,
  ): void {
    if (
      !this.isHudActive ||
      this.originalTilesetJson === null ||
      !this.supportsSliceSelection
    ) {
      return;
    }
    this.ensurePreloadQueue();
    const available = this.getAxisNumbers(axis);
    const neighbors = neighborhoodSliceNumbers(available, center, radius);
    const uriByNumber = this.getAxisUriMap(axis);
    const urls = neighbors
      .map((number) => uriByNumber.get(number))
      .filter((url): url is string => url !== undefined);
    this.preloadQueue!.enqueue(axis, urls, true);
  }

  /**
   * Build and load the tilesets for the slices immediately around `center` so
   * that stepping to a neighbour is a pure visibility flip.
   *
   * The HTTP prefetch queue only warms the browser cache; the expensive part of
   * a swap (glTF parse, texture decode, GPU upload) happens here instead, ahead
   * of time and off the interaction path.
   * No-op while the slice HUD panel isn't open (see `setHudActive`).
   */
  private warmAxisNeighborhood(
    axis: SeismicSliceAxis,
    center: number,
    radius: number = SLICE_GPU_WARM_RADIUS,
  ): void {
    if (!this.isHudActive) {
      return;
    }
    const slot = this.axisSlots.get(axis);
    if (slot === undefined || this.originalTilesetJson === null) {
      return;
    }
    const available = this.getAxisNumbers(axis);
    const neighbors = neighborhoodSliceNumbers(available, center, radius)
      .filter((number) => number !== center)
      .sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    if (neighbors.length === 0) {
      return;
    }
    void slot.warmSlices(
      this.originalTilesetJson,
      this.baseUrl,
      this.resourceHeaders,
      AXIS_TO_DIRECTION[axis],
      neighbors,
    );
  }

  private ensurePreloadQueue(): void {
    if (this.preloadQueue !== null) {
      return;
    }
    this.preloadQueue = new SlicePreloadQueue({
      headers: this.resourceHeaders,
      onProgress: (progress) => this.preloadProgress$.next(progress),
    });
  }

  /**
   * Stop background prefetching while the HUD is closed, without discarding
   * the queue's "already completed" bookkeeping — so reopening the HUD later
   * doesn't re-preload slices that were already fetched/warmed. Only
   * in-flight/pending network work is cancelled; already-completed URLs stay
   * remembered on the same `SlicePreloadQueue` instance.
   */
  private pausePreload(): void {
    this.preloadQueue?.abortAndClear();
  }

  /**
   * Fully tear down preloading (used when the layer itself is deactivated) —
   * unlike {@link pausePreload}, this also discards the queue's bookkeeping,
   * since the underlying tileset/slice data is being torn down too.
   */
  private stopPreload(): void {
    this.preloadQueue?.abortAndClear();
    this.preloadQueue = null;
    this.preloadProgress$.next(emptySlicePreloadProgress());
  }

  zoomIntoView(): void {
    void this.zoomIntoViewAsync();
  }

  private async zoomIntoViewAsync(): Promise<void> {
    const zoomToken = ++this.zoomGeneration;
    // Bounding spheres for the axis tilesets may not be ready yet (e.g. the
    // slice just finished loading a moment ago, or the user clicks the zoom
    // button right after activating the layer); wait briefly for a first,
    // possibly-partial sphere instead of flying to a degenerate/empty one.
    const firstSphere = await this.waitForAnyBoundingSphere();
    if (firstSphere === null || zoomToken !== this.zoomGeneration) {
      return;
    }
    this.flyToSphere(firstSphere);

    if (this.allAxisSlotsReady()) {
      return;
    }
    // Not every axis was ready yet: refine the framing once, in the
    // background, to the full three-plane union — without blocking the
    // initial fly above. Mirrors the double-buffered slice swap elsewhere in
    // this file: never withhold what's already available, only replace it
    // once the better version is ready.
    const completeSphere = await this.waitForAllAxesBoundingSphere();
    if (completeSphere === null || zoomToken !== this.zoomGeneration) {
      return;
    }
    this.flyToSphere(completeSphere);
  }

  private flyToSphere(sphere: BoundingSphere): void {
    // Use Cesium's default framing, like every other 3D-tiles/voxel layer
    // (`flyToBoundingSphere(sphere)` with no custom offset). A previous,
    // deliberately close/oblique framing (biased toward the surface, tilted
    // pitch) was used to avoid seeing thin vertical slices edge-on from
    // nadir, but it always left the camera very close to the tileset in a
    // near-horizontal pose — exactly the regime where the map-panning
    // controller's "vertical drag" math degenerates into an elevation change
    // instead of a pan (see camera-controller.service.ts). Consistency with
    // other layers' zoom behavior matters more than avoiding a possibly
    // edge-on initial view.
    this.viewer.camera.flyToBoundingSphere(sphere, { duration: 0.6 });
  }

  /** First non-degenerate sphere available, however partial. Fast/non-blocking. */
  private async waitForAnyBoundingSphere(
    timeoutMs = 2_000,
  ): Promise<BoundingSphere | null> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const sphere = this.computeVisibleBoundingSphere();
      if (sphere !== null && sphere.radius > 1) {
        return sphere;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
      this.viewer.scene.requestRender();
    }
    return this.computeVisibleBoundingSphere();
  }

  /** Union sphere once every axis slot participating in the selection is ready. */
  private async waitForAllAxesBoundingSphere(
    timeoutMs = 8_000,
  ): Promise<BoundingSphere | null> {
    const startedAt = Date.now();
    let best: BoundingSphere | null = null;
    while (Date.now() - startedAt < timeoutMs) {
      const sphere = this.computeVisibleBoundingSphere();
      if (sphere !== null && sphere.radius > 1) {
        best = sphere;
        if (this.allAxisSlotsReady()) {
          return sphere;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
      this.viewer.scene.requestRender();
    }
    // Timed out before every axis was ready — fall back to whichever
    // (possibly partial) union we already have, rather than nothing.
    return best ?? this.computeVisibleBoundingSphere();
  }

  /**
   * Whether every axis slot that participates in the current slice
   * selection has a tileset with a resolved bounding sphere. Used so
   * `waitForAllAxesBoundingSphere` frames the union of all three planes
   * instead of stopping as soon as the first (possibly small/narrow) one
   * happens to be ready — otherwise "zoom to object" can end up framing a
   * single thin plane edge-on, making it fill the view and look far more
   * extreme (e.g. much "deeper") than the whole slice cube actually is.
   */
  private allAxisSlotsReady(): boolean {
    if (!this.supportsSliceSelection) {
      return this._tileset?.boundingSphere !== undefined;
    }
    for (const axis of SEISMIC_SLICE_AXES) {
      const slot = this.axisSlots.get(axis);
      if (slot === undefined) {
        continue;
      }
      if (this.getAxisNumbers(axis).length === 0) {
        continue;
      }
      if (slot.currentTileset?.boundingSphere === undefined) {
        return false;
      }
    }
    return true;
  }

  private computeVisibleBoundingSphere(): BoundingSphere | null {
    const spheres: BoundingSphere[] = [];
    if (this.supportsSliceSelection) {
      for (const axis of SEISMIC_SLICE_AXES) {
        const tileset = this.axisSlots.get(axis)?.currentTileset;
        if (tileset?.boundingSphere !== undefined) {
          spheres.push(BoundingSphere.clone(tileset.boundingSphere));
        }
      }
    } else if (this._tileset?.boundingSphere !== undefined) {
      spheres.push(BoundingSphere.clone(this._tileset.boundingSphere));
    }
    if (spheres.length === 0) {
      return null;
    }
    let union = spheres[0];
    for (let i = 1; i < spheres.length; i++) {
      union = BoundingSphere.union(union, spheres[i], union);
    }
    return union;
  }

  moveToTop(): void {
    if (this.supportsSliceSelection) {
      for (const axis of SEISMIC_SLICE_AXES) {
        this.axisSlots.get(axis)?.raiseToTop();
      }
      return;
    }
    if (this._tileset !== undefined) {
      this.viewer.scene.primitives.raiseToTop(this._tileset);
    }
  }

  protected reactToChanges(): void {
    this.watch(this.layer.source);

    this.watch(this.layer.opacity, (opacity, previousOpacity) => {
      if (this.supportsSliceSelection) {
        for (const axis of SEISMIC_SLICE_AXES) {
          this.axisSlots.get(axis)?.setOpacity(opacity);
        }
        return;
      }
      if (this._tileset === undefined) {
        return;
      }
      if (opacity === 1 || previousOpacity === 1) {
        this._tileset.customShader = this.makeShader();
      } else {
        this._tileset.customShader!.setUniform('u_alpha', opacity);
      }
    });

    this.watch(this.layer.isVisible, (isVisible) => {
      if (this.supportsSliceSelection) {
        for (const axis of SEISMIC_SLICE_AXES) {
          this.axisSlots.get(axis)?.setVisible(isVisible);
        }
        return;
      }
      if (this._tileset !== undefined) {
        this._tileset.show = isVisible;
      }
    });

    this.watch(this.layer.sliceSelection, (selection) => {
      if (selection === null || !this.supportsSliceSelection) {
        return;
      }
      void this.applySliceSelection(selection);
    });
  }

  protected async addToViewer(): Promise<void> {
    const resource = await mapLayerSourceToResource(this.layer.source);

    if (
      this.layer.source.type === LayerSourceType.Ogc &&
      this.layer.source.displaySource === undefined
    ) {
      try {
        const resolved = await resolveOgcTilesetResource(
          resource.url,
          extractResourceHeaders(resource),
        );
        const metadata = parseTilesetSliceMetadata(resolved.json);
        if (hasSliceMetadata(metadata)) {
          await this.addSliceAwareTilesets(resolved, metadata);
          return;
        }
        await this.addFullTilesetFromResolved(resolved);
        return;
      } catch (error) {
        console.error('Failed to resolve OGC tileset, falling back:', error);
      }
    }

    await this.addFullTileset(resource);
  }

  protected removeFromViewer(): void {
    this.stopPreload();
    this.isHudActive = false;
    this.destroyAxisSlots();
    this.destroyFullTileset();
    this.originalTilesetJson = null;
    this.baseUrl = '';
    this.resourceHeaders = {};
    this.sliceMetadata = null;
    this.defaultSliceSelection = null;
    this.appliedNumbersByAxis.clear();
    this.uriMapByAxis.clear();
  }

  private async addSliceAwareTilesets(
    resolved: ResolvedTileset,
    metadata: TilesetSliceMetadata,
  ): Promise<void> {
    this.destroyFullTileset();
    this.destroyAxisSlots();

    this.originalTilesetJson = resolved.json;
    this.baseUrl = resolved.baseUrl;
    this.resourceHeaders = resolved.headers;
    this.sliceMetadata = metadata;
    this.defaultSliceSelection = createDefaultSliceSelection(metadata);

    for (const axis of SEISMIC_SLICE_AXES) {
      if (metadata.axes[axis] === undefined) {
        continue;
      }
      this.axisSlots.set(
        axis,
        new AxisTilesetSlot({
          viewer: this.viewer,
          makeShader: () => this.makeShader(),
          getOpacity: () => this.layer.opacity,
          getVisibility: () => this.layer.isVisible,
        }),
      );
    }

    const selection = this.layer.sliceSelection ?? this.defaultSliceSelection;
    await this.applySliceSelection(selection);

    // Background prefetching only starts once the HUD panel is opened (see
    // `setHudActive`) — no automatic warm-up here.

    const isInitialSelection = this.layer.sliceSelection === null;
    if (isInitialSelection) {
      LayerService.get().update(this.layer.id, { sliceSelection: selection });
    }
  }

  private async addFullTilesetFromResolved(
    resolved: ResolvedTileset,
  ): Promise<void> {
    const absoluteJson = absolutizeTilesetUris(resolved.json, resolved.baseUrl);
    const blobUrl = toBlobUrl(absoluteJson);
    const resource = createAuthenticatedBlobResource(blobUrl, resolved.headers);
    try {
      await this.addFullTileset(resource);
    } finally {
      // Cesium keeps using the blob URL via the Resource; revoke on remove.
      // Store for cleanup by piggy-backing on baseUrl when not slice-aware.
      this.baseUrl = blobUrl;
    }
  }

  private async addFullTileset(resource: Resource): Promise<void> {
    this.destroyAxisSlots();
    this.sliceMetadata = null;
    this.defaultSliceSelection = null;

    const tileset = await Cesium3DTileset.fromUrl(resource, {
      show: true,
    });

    tileset.imageBasedLighting = new ImageBasedLighting();
    tileset.imageBasedLighting.imageBasedLightingFactor = new Cartesian2(1, 0);
    tileset.customShader = this.makeShader();

    const pickService = PickService.get();
    const scenePickingLock = pickService.acquireScenePickingLock();

    const { primitives } = this.viewer.scene;
    const i =
      this._tileset === undefined || this._tileset === null
        ? null
        : this.findIndexInPrimitives(this._tileset);
    if (i === null) {
      primitives.add(tileset);
    } else {
      this.destroyFullTileset();
      primitives.add(tileset, i);
    }

    this._tileset = tileset;
    this.scenePickingLock = scenePickingLock;
    tileset.loadProgress.addEventListener(
      (numberOfPendingRequests: number, numberOfTilesProcessing: number) => {
        if (numberOfPendingRequests === 0 && numberOfTilesProcessing === 0) {
          this.scenePickingLock?.release();
          this.scenePickingLock = null;
        } else {
          this.scenePickingLock ??= pickService.acquireScenePickingLock();
        }
      },
    );
  }

  private async applySliceSelection(
    selection: Tiles3dSliceSelection,
  ): Promise<void> {
    if (
      this.originalTilesetJson === null ||
      this.sliceMetadata === null ||
      this.axisSlots.size === 0
    ) {
      return;
    }

    const numbersByAxis = this.resolveNumbersByAxis(selection);
    const updates: Array<Promise<void>> = [];

    for (const axis of SEISMIC_SLICE_AXES) {
      const slot = this.axisSlots.get(axis);
      if (slot === undefined) {
        continue;
      }
      const numbers = numbersByAxis[axis] ?? [];
      const numbersKey = JSON.stringify(numbers);
      if (this.appliedNumbersByAxis.get(axis) === numbersKey) {
        continue;
      }
      this.appliedNumbersByAxis.set(axis, numbersKey);

      if (numbers.length === 0) {
        slot.clear();
        continue;
      }
      updates.push(
        slot.setSlices(
          this.originalTilesetJson,
          this.baseUrl,
          this.resourceHeaders,
          AXIS_TO_DIRECTION[axis],
          numbers,
        ),
      );
    }

    await Promise.all(updates);
    if (selection.mode === 'single') {
      for (const axis of SEISMIC_SLICE_AXES) {
        const center = selection.single[axis];
        this.prioritizeAxisNeighborhood(axis, center);
        this.warmAxisNeighborhood(axis, center);
      }
    } else {
      this.startAxisPreload(selection);
    }
  }

  private resolveNumbersByAxis(
    selection: Tiles3dSliceSelection,
  ): Partial<Record<SeismicSliceAxis, number[]>> {
    const result: Partial<Record<SeismicSliceAxis, number[]>> = {};
    if (selection.mode === 'single') {
      for (const axis of SEISMIC_SLICE_AXES) {
        const available = this.getAxisNumbers(axis);
        if (available.length === 0) {
          continue;
        }
        const selected = selection.single[axis];
        result[axis] = available.includes(selected)
          ? [selected]
          : [available[Math.floor(available.length / 2)]];
      }
      return result;
    }

    // Multiple: only the active axis shows evenly spaced slices.
    for (const axis of SEISMIC_SLICE_AXES) {
      if (axis !== selection.multiple.axis) {
        result[axis] = [];
        continue;
      }
      const available = this.getAxisNumbers(axis);
      result[axis] = evenlySpacedSliceNumbers(
        available,
        selection.multiple.count,
      );
    }
    return result;
  }

  private destroyAxisSlots(): void {
    for (const slot of this.axisSlots.values()) {
      slot.destroy();
    }
    this.axisSlots.clear();
  }

  private destroyFullTileset(): void {
    const tileset = this._tileset;
    if (tileset !== undefined) {
      this.viewer.scene.primitives.remove(tileset);
      if (!tileset.isDestroyed()) {
        tileset.destroy();
      }
      this._tileset = undefined as unknown as Cesium3DTileset;
    }
    this.scenePickingLock?.release();
    this.scenePickingLock = null;
    if (this.baseUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.baseUrl);
      this.baseUrl = '';
    }
  }

  private makeShader(): CustomShader {
    const { opacity } = this.layer;
    return new CustomShader({
      translucencyMode:
        opacity === 1
          ? CustomShaderTranslucencyMode.OPAQUE
          : CustomShaderTranslucencyMode.TRANSLUCENT,

      //language=glsl
      fragmentShaderText: `
        const float WHITE_CUTOFF = 0.985;

        bool isWhite(vec3 color) {
          return all(greaterThanEqual(color, vec3(WHITE_CUTOFF)));
        }

        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
            material.specular = vec3(0.0);   // no view-dependent spec
            material.occlusion = 1.0;        // full diffuse
            material.alpha = u_alpha;
            if (u_isHighlighted) {
              material.diffuse = vec3(${OBJECT_HIGHLIGHT_NORMALIZED_RGB}); // highlight color
            }

            // Discard fully white (uncolored) fragments for partially transparent layers.
            if (u_isPartiallyTransparent && isWhite(material.baseColor.rgb)) {
              discard;
            }
          }
        `,
      uniforms: {
        u_alpha: {
          type: UniformType.FLOAT,
          value: opacity,
        },
        u_isHighlighted: {
          type: UniformType.BOOL,
          value: false,
        },
        u_isPartiallyTransparent: {
          type: UniformType.BOOL,
          value: this.layer.isPartiallyTransparent,
        },
      },
    });
  }
}
