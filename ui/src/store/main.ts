import {BehaviorSubject, Subject} from 'rxjs';
import type {Viewer} from 'cesium';
import type MapChooser from '../MapChooser';

export default class MainStore {
  private static viewerSubject = new BehaviorSubject<Viewer | null>(null);
  private static mapChooserSubject = new BehaviorSubject<MapChooser | null>(null);
  private static syncLayersSubject = new Subject<void>();
  private static layersRemovedSubject = new Subject<void>();
  private static syncMapSubject = new Subject<void>();
  private static voxelLayerCountSubject = new BehaviorSubject<string[]>([]);

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

  static get syncLayers() {
    return this.syncLayersSubject;
  }

  static nextLayersSync() {
    this.syncLayersSubject.next();
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
    const voxelLayers = this.visibleVoxelLayers.filter(l => l !== layer);
    this.voxelLayerCountSubject.next(voxelLayers);
  }

}
