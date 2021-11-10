import {BehaviorSubject, Subject} from 'rxjs';
import Slicer from '../slicer/Slicer';
import {NgmGeometry} from '../toolbox/interfaces';

export default class ToolboxStore {
  private static slicerSubject = new BehaviorSubject<Slicer | null>(null);
  private static rtcSubject = new Subject<any>();
  private static geometriesSubject = new BehaviorSubject<NgmGeometry[]>([]);
  private static geometryIdSubject = new BehaviorSubject<string | null>(null);

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

  static setGeometryId(value: string | null): void {
    this.geometryIdSubject.next(value);
  }

  static get geometryId(): BehaviorSubject<string | null> {
    return this.geometryIdSubject;
  }
}
