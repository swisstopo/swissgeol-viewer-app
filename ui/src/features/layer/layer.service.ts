import { BaseService } from 'src/services/base.service';
import { SessionService } from 'src/features/session';
import {
  BehaviorSubject,
  combineLatest,
  concatMap,
  filter,
  firstValueFrom,
  from,
  identity,
  map,
  Observable,
  of,
  pairwise,
  shareReplay,
  skip,
  startWith,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {
  LayerApiService,
  LayerGroupConfig,
} from 'src/features/layer/layer-api.service';
import { Id } from 'src/models/id.model';
import {
  AnyLayer,
  BACKGROUND_LAYER,
  BackgroundLayer,
  isBackgroundLayerId,
  Layer,
  LayerGroup,
  LayerType,
  WmtsLayer,
} from 'src/features/layer';
import { WmtsService } from 'src/services/wmts.service';
import {
  BaseLayerController,
  LayerController,
} from 'src/features/layer/controllers/layer.controller';
import { WmtsLayerController } from 'src/features/layer/controllers/layer-wmts.controller';
import { Viewer } from 'cesium';
import { Tiles3dLayerController } from 'src/features/layer/controllers/layer-tiles3d.controller';
import { BackgroundLayerController } from 'src/features/layer/controllers/layer-background.controller';
import { VoxelLayerController } from 'src/features/layer/controllers/layer-voxel.controller';
import { TiffLayerController } from 'src/features/layer/controllers/layer-tiff.controller';
import { KmlLayerController } from 'src/features/layer/controllers/layer-kml.controller';
import { EarthquakesLayerController } from 'src/features/layer/controllers/layer-earthquakes.controller';
import { CesiumService } from 'src/services/cesium.service';
import { GeoJsonLayerController } from 'src/features/layer/controllers/layer.geojson.controller';

export class LayerService extends BaseService {
  private viewer!: Viewer;

  private layerApiService!: LayerApiService;
  private wmtsService!: WmtsService;

  /**
   * A mapping of all currently known layers.
   * @private
   */
  private readonly layers: IdMapping<Layer, LayerEntry> = new Map();

  /**
   * A mapping of all currently known groups.
   * @private
   */
  private readonly groups: IdMapping<LayerGroup, GroupEntry> = new Map();

  /**
   * The ids of all root (i.e. top level) groups.
   * @private
   */
  private readonly _rootGroupIds$ = new BehaviorSubject<IdArray<LayerGroup>>(
    [],
  );

  /**
   * The ids of all currently active layers.
   *
   * Activating a layer adds them to the start of the array.
   * The first layer is the topmost one, the last the lowermost one.
   *
   * Each layer registered here has a `controller` defined.
   *
   * @private
   */
  private readonly _activeLayerIds$ = new BehaviorSubject<IdArray<Layer>>([]);

  /**
   * The background layer.
   *
   * Note that me mostly expose the background as "just another layer",
   * we store and manage it separately here as that makes handling it
   * inside this service much easier and clearer.
   *
   * @private
   */
  private readonly _background = {
    /**
     * The background layer's active state.
     */
    state$: new BehaviorSubject(BACKGROUND_LAYER),

    /**
     * The background's controller, responsible for displaying in on the map.
     * Note that this controller is always active.
     */
    controller: new BackgroundLayerController(BACKGROUND_LAYER),
  };

  /**
   * Whether the layers have been fetched from the API and stores into {@link layers} at least once.
   * @private
   */
  private readonly hasLayers$ = new BehaviorSubject(false);

  /**
   * Whether {@link viewer} is ready to use.
   * @private
   */
  private readonly hasViewer$ = new BehaviorSubject(false);

  /**
   * An observable that emits the changes between two versions of {@link _activeLayerIds$}.
   * This is used as the base for layer change emitters.
   *
   * @private
   */
  private readonly _layerChanges$ = this._activeLayerIds$.pipe(
    pairwise(),
    map(([previous, current]) => {
      const oldSet = new Set(previous);
      const newSet = new Set(current);

      const deactivated: Array<Id<Layer>> = [];
      for (const element of previous) {
        if (!newSet.has(element)) {
          deactivated.push(element);
        }
      }

      const activated: Array<Id<Layer>> = [];
      for (const element of current) {
        if (!oldSet.has(element)) {
          activated.push(element);
        }
      }

      return { activated, deactivated };
    }),
    shareReplay(1),
  );

  /**
   * An observable that emits whenever a layer is activated.
   * @private
   */
  private readonly _layerActivated$ = this._layerChanges$.pipe(
    concatMap(({ activated }) => from(activated)),
  );

  /**
   * An observable that emits whenever a layer is deactivated.
   * @private
   */
  private readonly _layerDeactivated$ = this._layerChanges$.pipe(
    concatMap(({ deactivated }) => from(deactivated)),
  );

  constructor() {
    super();

    CesiumService.inject()
      .then((s) => firstValueFrom(s.viewer$))
      .then((viewer) => {
        this.viewer = viewer;
        this.hasViewer$.next(true);
      });

    LayerApiService.inject().then((service) => {
      this.layerApiService = service;
    });

    // Load (and reload) the layers whenever the session changes.
    SessionService.inject$()
      .pipe(
        switchMap((service) =>
          service.initialized$.pipe(switchMap(() => service.user$)),
        ),
      )
      .subscribe(() => this.loadLayers());

    // Propagate changes in the WMTS layers to our local state.
    // This mostly happens due to language changes.
    WmtsService.inject$()
      .pipe(
        tap((wmtsService) => {
          this.wmtsService = wmtsService;
        }),
        switchMap((wmtsService) => wmtsService.layers$),
        filter(() => this.hasLayers$.value),
      )
      .subscribe((layers) => this.syncWmtsLayers(layers));
  }

  /**
   * Replace local WMTS layers with new values.
   * @param layers The layers to replace.
   * @private
   */
  private syncWmtsLayers(layers: WmtsLayer[]): void {
    for (const layer of layers) {
      const entry = this.layers.get(layer.id);
      if (entry === undefined) {
        continue;
      }
      const fields = {
        format: layer.format,
        credit: layer.credit,
        times: layer.times,
      } satisfies Partial<WmtsLayer>;

      const updatedState: WmtsLayer = {
        ...(entry.state$.value as WmtsLayer),
        ...fields,
      };

      const updatedDefinition: WmtsLayer = {
        ...(entry.definition as WmtsLayer),
        ...fields,
      };

      if (updatedState.label !== null) {
        updatedState.label = layer.label;
      }

      if (updatedDefinition.label !== null) {
        updatedDefinition.label = layer.label;
      }

      entry.definition = updatedDefinition;
      entry.state$.next(updatedState);
    }
  }

  /**
   * Loads all layers from the api and replaces the local state with them.
   * @private
   */
  private async loadLayers() {
    /**
     * Inserts a new layer into the local state.
     *
     * If the previous state contained an equivalent layer, then that layer's state will be reused.
     * @param layer
     */
    const insertLayer = (layer: Layer): void => {
      const previousLayer = previousLayers.get(layer.id);
      const entry = {
        definition: layer,
        groups: [],
      } satisfies Partial<LayerEntry>;
      if (previousLayer === undefined) {
        this.layers.set(layer.id, {
          ...entry,
          controller: null,
          state$: new BehaviorSubject(layer),
        });
      } else {
        previousLayers.delete(layer.id);
        const updated: LayerEntry = {
          ...entry,
          controller: previousLayer.controller,
          state$: previousLayer.state$,
        };
        this.layers.set(layer.id, updated);
        updated.controller?.update(layer);
        updated.state$.next(layer);
      }
    };

    /**
     * Inserts a new group into the local state.
     * @param group
     * @param parent
     */
    const insertGroup = (
      group: LayerGroupConfig,
      parent: Id<LayerGroup> | null,
    ): void => {
      const nodes: TreeNode[] = [];
      let count = 0;
      for (const node of group.children) {
        const inserted = insertGroupChild(node, group.id);
        if (inserted === null) {
          continue;
        }
        nodes.push(inserted);
        switch (inserted.type) {
          case TreeNodeType.Group:
            count += this.groups.get(inserted.id)!.count;
            break;
          case TreeNodeType.Layer:
            if (this._activeLayerIds$.value.includes(inserted.id)) {
              count += 1;
            }
            break;
        }
      }
      this.groups.set(group.id, { count, nodes, parent });
    };

    /**
     * Inserts a group's child into the local state.
     *
     * @param node The child to be inserted.
     * @param groupId The group to which the child belongs.
     */
    const insertGroupChild = (
      node: LayerGroupConfig | Id<Layer>,
      groupId: Id<LayerGroup>,
    ): TreeNode | null => {
      if (typeof node === 'object') {
        insertGroup(node, groupId);
        return { type: TreeNodeType.Group, id: node.id };
      } else {
        // skip layers that were filtered out (e.g. unavailable WMS/WMTS)
        if (!this.layers.has(node)) {
          return null;
        }
        registerGroupForLayer(node, groupId);
        return { type: TreeNodeType.Layer, id: node };
      }
    };

    /**
     * Marks a layer as part of a group.
     * Note that a layer may belong to multiple groups.
     *
     * @param id The layer's id.
     * @param groupId The group to which the layer belongs.
     */
    const registerGroupForLayer = (
      id: Id<Layer>,
      groupId: Id<LayerGroup>,
    ): void => {
      const layer = this.layers.get(id);
      if (layer === undefined) {
        throw new Error(`Unknown layer: ${id}`);
      }
      layer.groups = [...layer.groups, groupId];
    };

    // Fetch the layer config from the api.
    const config = await this.layerApiService.fetchLayerConfig();

    // The ids of all root groups, parsed from the new config.
    const rootGroupIds: Array<Id<LayerGroup>> = [];

    // Remove all old groups.
    this.groups.clear();

    // Back up the old layers, as we might want to reuse some of them.
    // After the state update, this array will contain only the layers that are not in use anymore.
    const previousLayers = new Map(this.layers);

    // Clear the old layers.
    this.layers.clear();

    // Insert the new layers into the local state.
    for (const layer of config.layers) {
      insertLayer(layer);
    }

    // Insert the new groups into the local state.
    for (const group of config.groups) {
      rootGroupIds.push(group.id);
      insertGroup(group, null);
    }

    // Ensure that all active layers still exist.
    const activeLayers = this._activeLayerIds$.value.filter((it) =>
      this.layers.has(it),
    );

    // Close any as-of-now unused layers.
    for (const entry of previousLayers.values()) {
      entry.state$.complete();
    }

    // Publish the new state.
    this._activeLayerIds$.next(activeLayers);
    this._rootGroupIds$.next(rootGroupIds);

    // If this is not the first time that the layers have been loaded, then we are done.
    if (this.hasLayers$.value) {
      return;
    }

    // The first time that the layers are loaded, we want to initialize the background afterward.
    // Note that we want to do this *after* loading the layers, but *before* marking the service as ready.
    // If we load the backgrounds too early, the Viewer is not fully initialized and may throw errors.
    // If we do it after *ready*, we get race conditions from activating layers due to url parameters.

    this.hasViewer$.pipe(filter(identity), take(1)).subscribe(async () => {
      // Mark the background as visible.
      const layer: BackgroundLayer = {
        ...this._background.state$.value,
        isVisible: true,
      };

      // Update the existing background controller and add it to the viewer.
      await this._background.controller.update(layer);
      await this._background.controller.add();

      // Publish the new background state.
      this._background.state$.next(layer);

      // Mark the layers as loaded.
      this.hasLayers$.next(true);
    });
  }

  /**
   * A promise that emits as soon as the service becomes ready to use.
   *
   * Using the service before this emits `true` may result in errors or unexpected behavior.
   * At the very least, the service will not hold the complete set of layers it wants to manage before this.
   */
  get ready(): Promise<void> {
    return firstValueFrom(
      combineLatest([this.hasLayers$, this.hasViewer$]).pipe(
        filter(([a, b]) => a && b),
        take(1),
        map(() => {}),
      ),
    );
  }

  /**
   * An observable emitting the ids of all top level groups.
   */
  get rootGroupIds$(): Observable<ReadonlyArray<Id<LayerGroup>>> {
    return this._rootGroupIds$.asObservable();
  }

  /**
   * An observable emitting the number of active layers within a specific group.
   *
   * If the group does not exist, it will emit `0`.
   *
   * @param id The id of the group.
   */
  groupCount$(id: Id<LayerGroup>): Observable<number> {
    return this.activeLayerIds$.pipe(
      map(() => this.groups.get(id)?.count ?? 0),
    );
  }

  /**
   * The {@link TreeNode nodes} of a group.
   *
   * If the group does not exist, an exception will be thrown.
   *
   * @param id The id of the group.
   */
  getNodesOfGroup(id: Id<LayerGroup>): readonly TreeNode[] {
    const entry = this.groups.get(id);
    if (entry === undefined) {
      throw new Error(`Unknown group: ${id}`);
    }
    return entry.nodes;
  }

  get background(): BackgroundLayer {
    return this._background.state$.value;
  }

  /**
   * The current state of a specific layer.
   *
   * If the layer does not exist, an exception will be thrown.
   *
   * @param id The id of the layer.
   */
  layer<T extends AnyLayer>(id: Id<T>): T {
    const layer = this.layerOrNull(id);
    if (layer === null) {
      throw new Error(`Unknown layer: ${id}`);
    }
    return layer;
  }

  /**
   * The current state of a specific layer, or `null` if the layer does not exist.
   *
   * @param id The id of the layer.
   */
  layerOrNull<T extends AnyLayer>(id: Id<T>): T | null {
    if (isBackgroundLayerId(id)) {
      return this._background.state$.value as T;
    }

    const entry = this.layers.get(id as Id<Layer>);
    if (entry === undefined) {
      return null;
    }
    return entry.state$.value as T;
  }

  /**
   * An observable emitting the live state of a specific layer.
   *
   * If the layer does not exist, an exception will be thrown.
   *
   * @param id The id of the layer.
   */
  layer$<T extends AnyLayer>(id: Id<T>): Observable<T> {
    if (isBackgroundLayerId(id)) {
      return this._background.state$.asObservable() as Observable<T>;
    }
    const entry = this.layers.get(id as Id<Layer>);
    if (entry === undefined) {
      throw new Error(`Unknown layer: ${id}`);
    }
    return entry.state$.asObservable() as Observable<T>;
  }

  /**
   * The ids of all currently known layers.
   *
   * Note that this may also include {@link activateCustomLayer custom layers}.
   */
  get layerIds(): ReadonlyArray<Id<Layer>> {
    return [...this.layers.keys()];
  }

  /**
   * Whether a specific layer exists.
   *
   * @param id The id of the layer.
   */
  hasLayer<T extends AnyLayer>(id: Id<T>): boolean {
    return isBackgroundLayerId(id) || this.layers.has(id as Id<Layer>);
  }

  /**
   * The ids of all currently active layers.
   */
  get activeLayerIds(): ReadonlyArray<Id<Layer>> {
    return this._activeLayerIds$.value;
  }

  /**
   * An observable emitting the ids of all active layers.
   */
  get activeLayerIds$(): Observable<ReadonlyArray<Id<Layer>>> {
    return this._activeLayerIds$.asObservable();
  }

  /**
   * An observable emitting the ids of all active layers.
   */
  get activeLayers$(): Observable<Layer[]> {
    return this.activeLayerIds$.pipe(
      map((ids) => ids.map((id) => this.layer(id))),
    );
  }

  /**
   * Whether a specific layer is currently active.
   *
   * Note that the background layer counts as permanently active.
   *
   * @param id The id of the layer.
   */
  isLayerActive(id: Id<AnyLayer>): boolean {
    return (
      isBackgroundLayerId(id) ||
      this._activeLayerIds$.value.includes(id as Id<Layer>)
    );
  }

  /**
   * An observable emitting whether a specific layer is active.
   *
   * Note that the background layer counts as permanently active.
   *
   * @param id The id of the layer.
   */
  isLayerActive$(id: Id<Layer> | Id<BackgroundLayer>): Observable<boolean> {
    if (isBackgroundLayerId(id)) {
      return of(true);
    }
    return this._activeLayerIds$.pipe(map((layerIds) => layerIds.includes(id)));
  }

  /**
   * An observable emitting whenever a layer is activated.
   *
   * The observable will start with all currently active layers.
   */
  get layerActivated$(): Observable<Id<Layer>> {
    return this._layerActivated$.pipe(
      startWith(...this._activeLayerIds$.value),
    );
  }

  /**
   * An observable emitting whenever a layer is deactivated.
   */
  get layerDeactivated$(): Observable<Id<Layer>> {
    return this._layerDeactivated$;
  }

  /**
   * Activates a specific layer.
   *
   * If the layer is already active, this is a no-op.
   *
   * @param id The id of the layer.
   */
  activate(id: Id<Layer> | Id<BackgroundLayer>): void {
    // The background is always active.
    if (isBackgroundLayerId(id)) {
      return;
    }

    // Find the layer's entry.
    const entry = this.layers.get(id);
    if (entry === undefined) {
      console.error(`Can't activate unknown layer: ${id}`);
      return;
    }

    // Cast the id and entry to usable types.
    const layerId = id as Id<Layer>;

    // Check if the layer is already activated and return if it is.
    const activeLayers = this._activeLayerIds$.value;
    if (activeLayers.includes(layerId)) {
      return;
    }

    // Mark the layer's groups (and all their parents) as containing one more active layer.
    for (const groupId of entry.groups) {
      this.iterateGroupPath(groupId, (group) => {
        group.count += 1;
      });
    }

    // Mark the layer as visible.
    const value = {
      ...entry.state$.value,
      isVisible: true,
    } satisfies Layer;

    // Create a controller for the layer and add it to the viewer.
    entry.controller = this.makeController(value);
    entry.controller.add().then(() => {
      this.viewer.scene.requestRender();
    });

    // Publish the new state.
    entry.state$.next(value);
    this._activeLayerIds$.next([layerId, ...activeLayers]);
  }

  /**
   * Deactivate a specific layer and reset its value.
   *
   * If the layer is already inactive, this is a no-op.
   *
   * @param id The id of the layer.
   */
  deactivate(id: Id<Layer>): void {
    if (isBackgroundLayerId(id)) {
      throw new Error("Can't deactivate the background layer.");
    }

    // Check if the layer is active and return if not.
    const activeLayers = this._activeLayerIds$.value;
    const i = activeLayers.indexOf(id);
    if (i < 0) {
      return;
    }

    // Find the layer's entry.
    // We assume that the entry must exist here, as otherwise, `activeLayers` wouldn't contain its id.
    const entry = this.layers.get(id) as LayerEntry;

    // Mark the layer's groups (and all their parents) as containing one less active layer.
    for (const groupId of entry.groups) {
      this.iterateGroupPath(groupId, (group) => {
        group.count -= 1;
      });
    }

    // Remove the layer's controller.
    // We can assume that the controller always exists here, as all active layers have a controller by definition.
    entry.controller!.remove();
    entry.controller = null;
    this.viewer.scene.requestRender();

    // Remove the layer from the list of active layers.
    const updatedActiveLayers = [...activeLayers];
    updatedActiveLayers.splice(i, 1);

    // Publish the new state.
    entry.state$.next(entry.definition);
    this._activeLayerIds$.next(updatedActiveLayers);

    // If the layer was a custom layer, we fully remove it now, as custom layers cannot be reactivated.
    if (isCustomLayer(entry)) {
      this.layers.delete(id);
    }
  }

  /**
   * Adds a custom layer to the activated layers list.
   *
   * While the layer is active, it will act like any other layer, and be accessible by normal means.
   * It is not added to a group, and thus not listed in the catalog.
   * Deactivating the layer will fully remove it from the application.
   *
   * Be aware that the layer must have a unique id.
   * Activating a custom layer that shares its id with another will log an error and ignore the new layer.
   *
   * @param layer The custom layer.
   */
  activateCustomLayer(layer: Layer): void {
    const hasLayer = this.layers.has(layer.id);
    if (hasLayer) {
      console.error(
        `Can't add custom layer, its id is already in use: ${layer.id}`,
      );
      return;
    }
    this.layers.set(layer.id, {
      state$: new BehaviorSubject(layer),
      definition: layer,
      controller: null,
      groups: [],
    });
    this.activate(layer.id);
  }

  /**
   * Actives a {@link activateCustomLayer custom layer} that fetches its data from the GeoAdmin WM(T)S service.
   *
   * @param layerId The id of the layer in WMTS.
   *
   * @see WmtsService
   */
  activateCustomLayerFromWmts(layerId: Id<WmtsLayer>): void {
    // Take the layer from WMTS and add it to the LayerService.
    const layer = this.wmtsService.layer(layerId);
    if (layer === null) {
      console.warn(
        `Can't activate layer as it doesn't exist in WMTS: ${layerId}`,
      );
      return;
    }
    this.activateCustomLayer(layer);

    // Update the layer when the WMTS service reloads it.
    const subscription = this.wmtsService
      .layer$(layerId)
      .pipe(skip(1))
      .subscribe((layer) => {
        if (layer === null) {
          this.deactivate(layerId);
        } else {
          this.update(layerId, layer);
        }
      });

    // Remove the WMTS subscription once the layer is deactivated.
    this.layerDeactivated$
      .pipe(
        filter((id) => id === layerId),
        take(1),
      )
      .subscribe(() => subscription.unsubscribe());
  }

  /**
   * Update the values of a specific layer.
   * This may affect the layer's representation on the viewer.
   *
   * @param id The id of the layer.
   * @param data The updated fields, or a function creating them.
   */
  update<T extends AnyLayer>(
    id: Id<T>,
    data: LayerUpdate<T> | ((layer: T) => LayerUpdate<T>),
  ): void {
    // Find the layer's entry.
    const entry = isBackgroundLayerId(id)
      ? { ...this._background, definition: BACKGROUND_LAYER }
      : this.layers.get(id as Id<Layer>);
    if (entry === undefined) {
      throw new Error(`Unknown layer: ${id}`);
    }

    const patch =
      typeof data === 'function' ? data(entry.state$.value as T) : data;

    // Update the layer.
    const updatedLayer = {
      ...entry.state$.value,
      ...patch,
    };

    // Ensure that the relationship between visibility and opacity is correct.
    // Note that we give precedence to `opacity` here, i.e. `isVisible` will be ignored if `opacity` is also updated.
    if ('opacity' in data && 'isVisible' in data) {
      // if both values are updated at the same time, we assume initialization and apply no automatisms.
    } else if ('opacity' in data) {
      // opacity = 0 ==> isVisible = false
      // opacity > 0 ==> isVisible = true
      updatedLayer.isVisible = updatedLayer.opacity !== 0;
    } else if ('isVisible' in data) {
      // If the layer has been made visible, we want opacity to be non-zero.
      // In case that the layer doesn't fulfill this, we reset the opacity to its default value.
      if (updatedLayer.isVisible && updatedLayer.opacity === 0) {
        updatedLayer.opacity = entry.definition.opacity;
      }
    }

    // Apply the update to the controller.
    (entry.controller as BaseLayerController<AnyLayer> | null)
      ?.update(updatedLayer)
      .then(() => {
        this.viewer.scene.requestRender();
      });

    // Publish the new state.
    (entry.state$ as BehaviorSubject<AnyLayer>).next(updatedLayer);
  }

  /**
   * Moves an active layer up or down inside the active layer list by a given amount.
   *
   * The amount will be clamped to the list's bounds.
   *
   * Moving up moves the layer further to the front of the list,
   * and to a higher level on the map itself.
   * This is indicated by a *negative* difference.
   *
   * Moving down moves the layer further to the end of the list,
   * and to a lower level on the map itself.
   * This is indicated by a *positive* difference.
   *
   * If the operation results in the layer not moving at all, this is a no-op.
   *
   * If the layer is inactive, an exception will be thrown.
   *
   * @param id The id of the layer.
   * @param difference The amount and direction the layer is moved in.
   */
  move(id: Id<Layer>, difference: number): void {
    // Create a copy of the active layer list.
    const ids = [...this._activeLayerIds$.value];

    // Find the current index of the layer.
    const oldIndex = ids.indexOf(id);
    if (oldIndex < 0) {
      console.error(`Can't move inactive layer: ${id}`);
      return;
    }

    // Calculate the new index.
    const newIndex = Math.max(0, Math.min(ids.length, oldIndex + difference));
    if (oldIndex === newIndex) {
      return;
    }

    // Remove the layer's id from the old index and insert it in the new one.
    ids.splice(oldIndex, 1);
    ids.splice(newIndex, 0, id);

    // Reorder the Cesium layers, with the first element in the array being the topmost one.
    for (let i = ids.length - 1; i >= 0; i--) {
      this.controller(ids[i])?.moveToTop();
    }

    // Publish the new state.
    this._activeLayerIds$.next(ids);
  }

  /**
   * The controller of a specific layer, if it exists.
   *
   * For an inactive layer, this always returns `null`
   *
   * @param id The id of the layer.
   */
  controller(id: Id<Layer>): LayerController | null;

  /**
   * The controller of the background layer.
   *
   * @param id The id of {@link BACKGROUND_LAYER}
   */
  controller(id: Id<BackgroundLayer>): BackgroundLayerController;

  /**
   * The controller of a specific layer, if it exists.
   *
   * For an inactive layer, this always returns `null`
   *
   * @param id The id of the layer.
   */
  controller(
    id: Id<AnyLayer>,
  ): BackgroundLayerController | LayerController | null;

  controller<T extends AnyLayer>(id: Id<T>): BaseLayerController<T> | null {
    if (isBackgroundLayerId(id)) {
      return this._background.controller as unknown as BaseLayerController<T>;
    }
    return (this.layers.get(id as Id<Layer>)?.controller ??
      null) as BaseLayerController<T> | null;
  }

  /**
   * The controllers of all active layers.
   */
  get controllers(): ReadonlyArray<LayerController> {
    return this._activeLayerIds$.value.map((id) => this.controller(id)!);
  }

  /**
   * Creates a new {@link LayerController} for a given layer.
   *
   * @param layer The layer.
   * @private
   */
  private makeController(layer: Layer): LayerController {
    switch (layer.type) {
      case LayerType.Wmts:
        return new WmtsLayerController(layer);
      case LayerType.Tiles3d:
        return new Tiles3dLayerController(layer);
      case LayerType.Voxel:
        return new VoxelLayerController(layer);
      case LayerType.Tiff:
        return new TiffLayerController(layer);
      case LayerType.GeoJson:
        return new GeoJsonLayerController(layer);
      case LayerType.Kml:
        return new KmlLayerController(layer);
      case LayerType.Earthquakes:
        return new EarthquakesLayerController(layer);
    }
  }

  /**
   * Iterates the {@link GroupEntry entries} of a group and its parents in reverse order.
   *
   * @param groupId The id of the lowermost group.
   * @param handle A function receiving all entries.
   * @private
   */
  private iterateGroupPath(
    groupId: Id<LayerGroup>,
    handle: (entry: GroupEntry) => void,
  ): void {
    const group = this.groups.get(groupId);
    if (group === undefined) {
      throw new Error(`Unknown group: ${groupId}`);
    }
    let lastGroup = group;
    for (;;) {
      handle(lastGroup);
      if (lastGroup.parent === null) {
        return;
      }
      lastGroup = this.groups.get(lastGroup.parent)!;
    }
  }
}

/**
 * A partial selection of a layer's fields.
 */
export type LayerUpdate<T = AnyLayer> = Partial<
  Omit<T, 'type' | 'id' | 'canUpdateOpacity'>
>;

/**
 * A child of a group.
 * This contains the id of either a layer or of a subgroup.
 */
export type TreeNode =
  | { type: TreeNodeType.Group; id: Id<LayerGroup> }
  | { type: TreeNodeType.Layer; id: Id<Layer> };

/**
 * The types of {@link TreeNode}.
 */
export enum TreeNodeType {
  Group,
  Layer,
}

/**
 * A read-only array of ids of a specific type.
 */
type IdArray<T> = ReadonlyArray<Id<T>>;

/**
 * A mapping of ids to values.
 */
type IdMapping<T, V> = Map<Id<T>, V>;

/**
 * A layer's entry, containing the local state of a specific layer.
 */
interface LayerEntry {
  /**
   * The layer's actual live state.
   */
  state$: BehaviorSubject<Layer>;

  /**
   * The layer's base definition.
   * This can be used to reset the layer to its default state.
   */
  definition: Layer;

  /**
   * A list of groups to which the layer belongs.
   *
   * This is *not* a path, but simply the groups that the layer is directly owned by.
   * This means that e.g. for a layer referenced only by one group, this array contains only that group's id,
   * no matter how deep the group itself may be nested.
   */
  groups: IdArray<LayerGroup>;

  /**
   * The controller of the layer.
   * This is only set if the layer is active and removed when the layer is made inactive.
   */
  controller: BaseLayerController<Layer> | null;
}

/**
 * A group's entry, containing the local state of a specific group.
 */
interface GroupEntry {
  /**
   * The groups' children.
   */
  nodes: readonly TreeNode[];

  /**
   * The id of the group's parent.
   * When this is `null`, then the group is located at the top level.
   */
  parent: Id<LayerGroup> | null;

  /**
   * The number of active layers inside the group,
   * including deeply nested layers.
   */
  count: number;
}

const isCustomLayer = (entry: LayerEntry): boolean => entry.groups.length === 0;
