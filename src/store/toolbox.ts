import {BehaviorSubject, Subject} from 'rxjs';
import Slicer from '../slicer/Slicer';
import {NgmGeometry} from '../toolbox/interfaces';

interface OpenedGeometryOptions {
  id: string,
  editing?: boolean
}

export default class ToolboxStore {
  private static slicerSubject = new BehaviorSubject<Slicer | null>(null);
  private static rtcSubject = new Subject<any>();
  private static geometriesSubject = new BehaviorSubject<NgmGeometry[]>([]);
  private static openedGeometryOptionsSubject = new BehaviorSubject<OpenedGeometryOptions | null>(null);
  private static sliceGeometrySubject = new BehaviorSubject<NgmGeometry | null | undefined>(null);

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

  static setOpenedGeometryOptions(value: OpenedGeometryOptions | null): void {
    this.openedGeometryOptionsSubject.next(value);
  }

  static get openedGeometryOptions(): BehaviorSubject<OpenedGeometryOptions | null> {
    return this.openedGeometryOptionsSubject;
  }

  static get openedGeometry(): NgmGeometry | undefined {
    return this.geometriesSubject.getValue().find(geom => geom.id === this.openedGeometryOptions.getValue()?.id);
  }

  static setSliceGeometry(value: NgmGeometry | null | undefined): void {
    if (value && value.id === this.sliceGeometry.getValue()?.id)
      value = null;
    this.sliceGeometrySubject.next(value);
  }

  static get sliceGeometry(): BehaviorSubject<NgmGeometry | null | undefined> {
    return this.sliceGeometrySubject;
  }

  static get geomSliceActive(): boolean {
    return this.sliceGeometrySubject.getValue()?.id === this.openedGeometryOptions.getValue()?.id;
  }
}
