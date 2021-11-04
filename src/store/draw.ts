import {BehaviorSubject} from 'rxjs';
import {NgmGeometry} from '../toolbox/ngm-aoi-drawer';

export default class DrawStore {
  private static drawStateSubject = new BehaviorSubject<boolean>(false);
  private static geometriesSubject = new BehaviorSubject<NgmGeometry[]>([]);

  static setDrawState(value: boolean): void {
    this.drawStateSubject.next(value);
  }

  static get drawState(): BehaviorSubject<boolean> {
    return this.drawStateSubject;
  }

  static get drawStateValue(): boolean {
    return this.drawStateSubject.getValue();
  }

  static setGeometries(value: NgmGeometry[]): void {
    this.geometriesSubject.next(value);
  }

  static get geometries(): BehaviorSubject<NgmGeometry[]> {
    return this.geometriesSubject;
  }

  static get geometriesValue(): NgmGeometry[] {
    return this.geometriesSubject.getValue();
  }
}
