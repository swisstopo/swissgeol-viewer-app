import {BehaviorSubject, Subject} from 'rxjs';
import Slicer from '../slicer/Slicer';
import {NgmGeometry} from '../toolbox/interfaces';

export default class ToolboxStore {
  private static slicerSubject = new BehaviorSubject<Slicer | null>(null);
  private static rtcSubject = new Subject<any>();
  private static geometriesSubject = new BehaviorSubject<NgmGeometry[]>([]);

  static get slicer(): BehaviorSubject<Slicer | null> {
    return this.slicerSubject;
  }

  static setSlicer(value: Slicer): void {
    this.slicerSubject.next(value);
  }

  static get geometryToCreate(): Subject<any> {
    return this.rtcSubject;
  }

  static setGeometryToCreate(value: NgmGeometry): void {
    this.rtcSubject.next(value);
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

  static updateGeometry(geom): void {
    const geometries = this.geometriesValue;
    const indx = geometries.findIndex(g => g.id === geom.id);
    if (indx === -1) throw new Error(`Geometry '${geom.id}' not found`);
    geometries[indx] = geom;
    this.setGeometries(geometries);
  }
}
