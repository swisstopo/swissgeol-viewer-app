import {BehaviorSubject} from 'rxjs';
import {Viewer} from 'cesium';
import MapChooser from '../MapChooser';

export default class MainStore {
  private static viewer = new BehaviorSubject<Viewer | null>(null)
  private static mapChooser = new BehaviorSubject<MapChooser | null>(null)

  static getViewer(): BehaviorSubject<Viewer | null> {
    return this.viewer;
  }

  static setViewer(value: Viewer): void {
    this.viewer.next(value);
  }

  static getMapChooser(): BehaviorSubject<MapChooser | null> {
    return this.mapChooser;
  }

  static setMapChooser(value: MapChooser): void {
    this.mapChooser.next(value);
  }
}
