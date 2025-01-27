import { BehaviorSubject, Subject } from 'rxjs';
import { Viewer } from 'cesium';
import type MapChooser from '../MapChooser';
import { getIonToken, setIonToken } from '../permalink';
import { IonAsset } from '../api-ion';

export default class MainStore {
  private static readonly viewerSubject = new BehaviorSubject<Viewer | null>(
    null,
  );
  private static readonly mapChooserSubject =
    new BehaviorSubject<MapChooser | null>(null);
  private static readonly layersRemovedSubject = new Subject<void>();
  private static readonly syncMapSubject = new Subject<void>();
  private static readonly voxelLayerCountSubject = new BehaviorSubject<
    string[]
  >([]);
  private static readonly ionTokenSubject = new BehaviorSubject<string | null>(
    getIonToken(),
  );
  private static readonly ionAssetSubject = new Subject<IonAsset>();
  private static readonly removeIonAssetsSubject = new Subject<void>();
  static readonly setUrlLayersSubject = new Subject<void>();
  static readonly syncLayerParams = new Subject<void>();
  /**
   * List of uploaded KML dataSource names. Required to get list of uploaded layers and update properties in batch (e.g. exaggeration)
   * @private
   */
  private static readonly uploadedKmlListSubject = new BehaviorSubject<
    string[]
  >([]);

  static get viewer(): BehaviorSubject<Viewer | null> {
    return this.viewerSubject;
  }

  static get viewerValue(): Viewer | null {
    return this.viewerSubject.getValue();
  }

  static setViewer(value: Viewer): void {
    this.viewerSubject.next(value);
  }

  static get mapChooser(): BehaviorSubject<MapChooser | null> {
    return this.mapChooserSubject;
  }

  static setMapChooser(value: MapChooser): void {
    this.mapChooserSubject.next(value);
  }

  static get layersRemoved() {
    return this.layersRemovedSubject;
  }

  static nextLayersRemove() {
    this.layersRemovedSubject.next();
  }

  static get syncMap() {
    return this.syncMapSubject;
  }

  static nextMapSync() {
    this.syncMapSubject.next();
  }

  static get visibleVoxelLayers() {
    return this.voxelLayerCountSubject.getValue();
  }

  static addVisibleVoxelLayer(layer) {
    const voxelLayers = this.visibleVoxelLayers;
    if (!voxelLayers.includes(layer)) {
      voxelLayers.push(layer);
      this.voxelLayerCountSubject.next(voxelLayers);
    }
  }

  static removeVisibleVoxelLayer(layer) {
    const voxelLayers = this.visibleVoxelLayers.filter((l) => l !== layer);
    this.voxelLayerCountSubject.next(voxelLayers);
  }

  static setIonToken(token: string) {
    this.ionTokenSubject.next(token);
    setIonToken(token);
  }

  static get ionToken(): BehaviorSubject<string | null> {
    return this.ionTokenSubject;
  }

  static addIonAssetId(ionAsset: IonAsset) {
    this.ionAssetSubject.next(ionAsset);
  }

  static get onIonAssetAdd() {
    return this.ionAssetSubject;
  }

  static removeIonAssets() {
    this.removeIonAssetsSubject.next();
  }

  static get onRemoveIonAssets(): Subject<void> {
    return this.removeIonAssetsSubject;
  }

  /**
   * Returns the list of uploaded KML dataSource names
   */
  static get uploadedKmlNames(): string[] {
    return this.uploadedKmlListSubject.value;
  }

  /**
   * Adds uploaded KML dataSource name to the list
   */
  static addUploadedKmlName(name: string) {
    const names = this.uploadedKmlNames;
    names.push(name);
    this.uploadedKmlListSubject.next(names);
  }
}
