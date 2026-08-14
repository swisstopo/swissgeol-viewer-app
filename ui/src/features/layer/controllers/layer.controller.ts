import { IonResource, Resource, Viewer } from 'cesium';
import {
  BaseLayer,
  LayerSource,
  LayerSourceType,
  LayerType,
  OgcSourceType,
} from 'src/features/layer';
import { WmtsLayerController } from 'src/features/layer/controllers/layer-wmts.controller';
import { Tiles3dLayerController } from 'src/features/layer/controllers/layer-tiles3d.controller';
import S3Resource from 'src/cesium/S3Resource';
import { VoxelLayerController } from 'src/features/layer/controllers/layer-voxel.controller';
import { TiffLayerController } from 'src/features/layer/controllers/layer-tiff.controller';
import { KmlLayerController } from 'src/features/layer/controllers/layer-kml.controller';
import { EarthquakesLayerController } from 'src/features/layer/controllers/layer-earthquakes.controller';
import { CesiumService } from 'src/services/cesium.service';
import { GeoJsonLayerController } from 'src/features/layer/controllers/layer.geojson.controller';

export type LayerController =
  | WmtsLayerController
  | Tiles3dLayerController
  | VoxelLayerController
  | TiffLayerController
  | KmlLayerController
  | GeoJsonLayerController
  | EarthquakesLayerController;

/**
 * A {@link LayerController} is responsible for managing how a {@link Layer} is displayed on the {@link Viewer}.
 *
 * A controller instance will be created when a layer is added to the viewer,
 * and will be discarded once the layer is removed.
 *
 * This is an abstract base class.
 * Instance types are chosen based on the {@link BaseLayer.type type} of the layer that should be displayed.
 *
 * ### Lifecycle
 * #### Lifecycle - Creation
 * A new instance is created via the constructor:
 * ```ts
 * const myController = new MyLayerController(theLayerInstance, theViewer)
 * ```
 * This adds the layer to the viewer and displays it with the layer's default settings.
 *
 *
 * #### Lifecycle - Update
 * Changes to the layer are propagated the controller via `update`:
 * ```ts
 * myController.update(theUpdatedLayerInstance)
 * ```
 * This reacts to changes on the layer and applies them to the viewer.
 * Depending on the severity of the changes, one of following things will happen:
 *
 * 1. The viewer stays as-is - nothing happens.
 * 2. The current Cesium layer is adjusted.
 * 3. The current Cesium layer is replaced with a new one.
 * 4. The current Cesium layer is (temporarily) removed from the viewer.
 *
 * Which of these is applied fully depends on the exact controller type.
 *
 *
 * #### Lifecyle - Removal
 * To remove the layer from the viewer, simply call `remove`:
 * ```ts
 * myController.remove()
 * ```
 * Note that the controller instance should not be used afterward.
 *
 *
 * ## Implementation
 * Specific controller implementations need to provide the following aspects:
 * Creation and replacement, adjustment and removal.
 *
 * ### Creation and Replacement
 * To create the controller's data and initialize it, {@link BaseLayerController.addToViewer} has to be implemented.
 * This method will be called once from inside the layer's controller,
 * and once whenever a {@link BaseLayerController.watch watched value} requested a reinitialization.
 * Note that you should never implement behavior in your own controller, but instead use this method for all initialization.
 *
 * ### Adjustment
 * To react to changes, {@link BaseLayerController.reactToChanges} has to be implemented.
 * Inside this method, you can register value watchers using {@link BaseLayerController.watch}.
 * Watched values can either adjust the existing Cesium layer, or request a reinitialization.
 *
 * ### Removal
 * To allow removal, {@link BaseLayerController.removeFromViewer} has to be implemented.
 * This method should remove all owned data from the viewer, and fully free any other resources.
 */
export abstract class BaseLayerController<T extends BaseLayer> {
  /**
   * All watched values, in the order in which they were registered.
   *
   * Note that this array contains only the most recent set of values.
   * It is used to compare changes between two consecutive versions of the same layer.
   *
   * @private
   */
  private readonly watchedValues: unknown[] = [];

  /**
   * The index within {@link watchedValues} that the next call to {@link watch} references.
   * This should only be updated while {@link reactToChanges} is being run,
   * and is `0` otherwise.
   *
   * @private
   */
  private currentWatchIndex = 0;

  /**
   * A set of actions that should be applied in order to sync the Cesium layer with the actual layer data.
   * These changes should all be applied exactly once after {@link reactToChanges} has been executed.
   *
   * @private
   */
  private requestedChanges: Array<() => void> = [];

  /**
   * Whether the most recent call to {@link reactToChanges} has requested for a reinitialization.
   * After reinitialization, this should be reset to `false`.
   *
   * @private
   */
  private hasRequestedReinitialization = false;

  /**
   * Whether the first, initial Cesium layer has been created yet.
   * @private
   */
  private isInitialized = false;

  /**
   * The current layer data.
   *
   * @private
   */
  private _layer: T;

  private _viewer!: Viewer;

  /**
   * A promise that represents the currently running update.
   * This is `null` when there is no update running.
   *
   * This value is used to ensure that only a single update runs at a time.
   *
   * @private
   */
  private activeUpdate: Promise<void> | null = null;

  /**
   * The next queued update.
   * This is only used when an {@link activeUpdate} is present,
   * and will be resolved by the update process once it has concluded its current update.
   *
   * A queued update contains the updated value at index 0 and a callback at index 1.
   * The callback is invoked once the queued update has been applied.
   *
   * @private
   */
  private nextUpdate: [T, () => void] | null = null;

  constructor(
    /**
     * The layer's initial data.
     */
    layer: T,
  ) {
    this._layer = layer;
    this.reactToChanges();
    this.currentWatchIndex = 0;
  }

  /**
   * The layer data currently displayed by the controller.
   */
  get layer(): T {
    return this._layer;
  }

  protected get viewer(): Viewer {
    return this._viewer;
  }

  abstract get type(): LayerType | 'Background';

  add(): Promise<void> {
    if (this.isInitialized) {
      return Promise.resolve();
    }
    this._viewer = CesiumService.get().viewerOrNull!;
    if (this._viewer === null) {
      throw new Error("Can't add controller before viewer initialization.");
    }

    // Mark as initialized - updates will be queued, so this is safe.
    this.isInitialized = true;
    return this.processUpdates(this.addToViewer());
  }

  /**
   * Updates the controller's current layer data,
   * adjusting the Cesium viewer where needed.
   *
   * Note that updates are queued so only a single update runs at a time.
   *
   * @param layer The updated layer data.
   */
  update(layer: T): Promise<void> {
    // If there is no active update, we can apply the new value immediately.
    if (this.activeUpdate === null) {
      return this.processUpdates(this.runUpdate(layer));
    }

    // We need to queue our update as there is already an active process.

    // If there is no queued update, we can take that spot.
    if (this.nextUpdate === null) {
      return new Promise((resolve) => {
        this.nextUpdate = [layer, resolve];
      });
    }

    // There is already a queued update.
    // We replace that queued value with our own (which is safe as we have a full copy of the layer data).
    // It's important that we preserve all queued callbacks and run them after the update.
    const [_previousUpdate, previousCallback] = this.nextUpdate;
    return new Promise((resolve) => {
      this.nextUpdate = [
        layer,
        () => {
          previousCallback();
          resolve();
        },
      ];
    });
  }

  private processUpdates(process: Promise<void>): Promise<void> {
    if (this.activeUpdate !== null) {
      throw new Error(
        "Can't process updates, there is already an update running.",
      );
    }
    this.activeUpdate = process;
    return new Promise((resolve, reject) =>
      process.then(
        () => {
          resolve();
          this.activeUpdate = null;

          if (this.nextUpdate === null) {
            return;
          }

          const [nextUpdate, callback] = this.nextUpdate;
          this.nextUpdate = null;

          this.update(nextUpdate).then(() => {
            callback();
          });
        },
        (error: unknown) => {
          this.activeUpdate = null;
          this.nextUpdate = null;
          reject(error);
        },
      ),
    );
  }

  private async runUpdate(layer: T): Promise<void> {
    // Update the local layer data.
    // Note that we do this *before* checking for changes, as change detection is handled via `watchedValues`.
    this._layer = layer;

    // Check if there are any changes between the current and the new dataset.
    this.reactToChanges();

    // If we have not been initialized yet, we skip all further steps.
    // The update simply changed our local layer and the watched initial values.
    if (!this.isInitialized) {
      this.currentWatchIndex = 0;
      this.requestedChanges = [];
      return;
    }

    // If the changes require the current Cesium layer to be removed and a new one to be added,
    // we have to re-run `addToViewer`.
    if (this.hasRequestedReinitialization) {
      await this.addToViewer();
    }
    this.hasRequestedReinitialization = false;

    // Apply any adjustments to the current layer.
    // Note that we do this even if we have reinitialized the layer,
    // as there may be adjustments that are not handled by `addToViewer` itself.
    for (const change of this.requestedChanges) {
      change();
    }

    // Reset the temporary watch fields.
    this.currentWatchIndex = 0;
    this.requestedChanges = [];
  }

  /**
   * Remove the layer from the viewer and destroy the controller's owned data.
   */
  remove(): void {
    this.removeFromViewer();
  }

  /**
   * Zooms the viewer to the layer's location.
   */
  abstract zoomIntoView(): void;

  /**
   * Moves the layer to the top of the map.
   */
  abstract moveToTop(): void;

  /**
   * Updates the layer's exaggeration.
   *
   * This is called whenever the Cesium scene's exaggeration changes.
   * For most layers, this is a no-op, as their exaggeration is directly tied to the scene's.
   *
   * @param _exaggeration
   */
  updateExaggeration(_exaggeration: number): void {
    // Nop-op by default, as the scene's exaggeration is enough for most layers.
  }

  /**
   * Checks if the Cesium layer needs to be adjusted based on the current layer data.
   *
   * Note that this method should mostly consist of calls to {@link watch},
   * with no conditional or other side effects.
   *
   * @protected
   */
  protected abstract reactToChanges(): void;

  /**
   * Adds the layer to the viewer.
   * If the layer has already been added, this instead replaces the current Cesium layer with a new one.
   *
   * @protected
   */
  protected abstract addToViewer(): Promise<void>;

  /**
   * Removes the Cesium layer from the viewer, fully destroying it in the process.
   *
   * @protected
   */
  protected abstract removeFromViewer(): void;

  /**
   * Compares a value to its previous version.
   *
   * If the value has changed, `action` will be called.
   * If `action` doesn't exist, a reinitializaton is requested instead.
   *
   * Note that when a value is checked for the first time (i.e. there is no preceding version),
   * this is essentially a no-op, called only to register the value for later comparison.
   *
   * @param value The update value.
   * @param action An action to execute when the value has changed. This is assumed to adjust the Cesium layer.
   * @protected
   */
  protected watch<T>(
    value: T,
    action?: (value: T, previousValue: T | undefined) => void,
  ): void {
    if (!this.isInitialized) {
      this.watchedValues.push(value);
    }
    const lastValue = this.watchedValues[this.currentWatchIndex] as
      T | undefined;
    this.watchedValues[this.currentWatchIndex] = value;
    this.currentWatchIndex += 1;

    if (this.haveValuesChanged(value, lastValue)) {
      if (action === undefined) {
        this.hasRequestedReinitialization = true;
      } else {
        this.requestedChanges.push(() => action(value, lastValue));
      }
    }
  }

  /**
   * Checks whether two versions of a value have any differences between them.
   *
   * This is *not* deep equality, but simple identity checks with support for array iteration.
   *
   * @param a The first value.
   * @param b The second value.
   * @return Whether the two values have changed, i.e. are not identical.
   * @private
   */
  private haveValuesChanged(a: unknown, b: unknown): boolean {
    if (a === b) {
      return false;
    }
    if (!(Array.isArray(a) && Array.isArray(b)) || a.length === b.length) {
      return true;
    }
    for (let i = 0; i < a.length; i++) {
      const aElement = a[i];
      const bElement = b[i];
      if (this.haveValuesChanged(aElement, bElement)) {
        return true;
      }
    }
    return false;
  }

  protected findIndexInPrimitives(primitive: unknown): number | null {
    const { primitives } = this.viewer.scene;
    for (let i = 0; i < primitives.length; i++) {
      const current = primitives.get(i);
      if (current === primitive) {
        return i;
      }
    }
    return null;
  }
}

export const mapLayerSourceToResource = async (
  source: LayerSource,
): Promise<Resource> => {
  switch (source.type) {
    case LayerSourceType.CesiumIon:
      return await IonResource.fromAssetId(source.assetId, {
        accessToken: source.accessToken,
      });
    case LayerSourceType.Url:
      return new Resource(source.url);
    case LayerSourceType.S3:
      return new S3Resource({
        bucket: source.bucket,
        key: source.key,
      });
    case LayerSourceType.Ogc: {
      if (source.displaySource !== undefined) {
        return mapLayerSourceToResource(source.displaySource);
      }

      // TODO At some point, we will have to differentiate between different formats.
      //      Right now, only 3dtiles can be fetched via OGC.
      const ogcSource = source.ogcSource;
      let url: string;
      switch (ogcSource.type) {
        case OgcSourceType.Gst:
          url = ogcSource.styleId
            ? `https://ogc-api.gst-viewer.swissgeol.ch/collections/${ogcSource.id}/styles/${ogcSource.styleId}/download_format/tiles3d`
            : `https://ogc-api.gst-viewer.swissgeol.ch/collections/${ogcSource.id}/download_format/tiles3d`;
          break;
        case OgcSourceType.Stac:
          url = `https://ogc-api.gst-viewer.swissgeol.ch/collections/${ogcSource.collection}/download_format/tiles3d`;
          break;
        case OgcSourceType.Fdsn:
        case OgcSourceType.Wms:
          throw new Error(`Unsupported OGC source type: ${ogcSource.type}`);
      }

      return new Resource({
        url,
        headers: {
          Authorization: `Basic ${import.meta.env['VITE_OGC_GST_BASIC_AUTH']}`,
        },
      });
    }
  }
};
