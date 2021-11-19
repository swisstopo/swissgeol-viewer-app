import {BehaviorSubject, Subject} from 'rxjs';
import {Viewer} from 'cesium';
import MapChooser from '../MapChooser';

export default class MainStore {
  private static viewerSubject = new BehaviorSubject<Viewer | null>(null);
  private static mapChooserSubject = new BehaviorSubject<MapChooser | null>(null);
  private static syncLayersSubject = new Subject<void>();
  private static syncMapSubject = new Subject<void>();
  private static syncTargetPointSubject = new Subject<void>();

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

  static get syncMap() {
    return this.syncMapSubject;
  }

  static nextMapSync() {
    this.syncMapSubject.next();
  }

  static get syncTargetPoint() {
    return this.syncTargetPointSubject;
  }

  static nextTargetPointSync() {
    this.syncTargetPointSubject.next();
  }

}
