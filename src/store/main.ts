import {BehaviorSubject} from 'rxjs';
import {Viewer} from 'cesium';
import MapChooser from '../MapChooser';

export default class MainStore {
  private static viewerSubject = new BehaviorSubject<Viewer | null>(null)
  private static mapChooserSubject = new BehaviorSubject<MapChooser | null>(null)

  static get viewer(): BehaviorSubject<Viewer | null> {
    return this.viewerSubject;
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
}
