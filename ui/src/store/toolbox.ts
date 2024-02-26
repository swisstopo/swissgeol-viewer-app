import {BehaviorSubject, Subject} from 'rxjs';
import type Slicer from '../geoblocks/cesium-helpers/slicer/Slicer';
import type {GeometryTypes, NgmGeometry} from '../toolbox/interfaces';

export interface OpenedGeometryOptions {
  id: string,
  editing?: boolean
}

export interface GeometryAction {
  id?: string,
  type?: GeometryTypes,
  file?: File,
  newName?: string,
  noEditGeometries?: boolean,
  action: 'remove' | 'zoom' | 'hide' | 'show' | 'copy' | 'showAll' | 'hideAll' | 'pick' | 'downloadAll' | 'profile' |
      'add' | 'upload' | 'changeName' | 'removeAll',
}

export default class ToolboxStore {
  private static slicerSubject = new BehaviorSubject<Slicer | null>(null);
  private static rtcSubject = new Subject<any>();
  private static geometriesSubject = new BehaviorSubject<NgmGeometry[]>([]);
  private static noEditGeometriesSubject = new BehaviorSubject<NgmGeometry[]>([]);
  private static openedGeometryOptionsSubject = new BehaviorSubject<OpenedGeometryOptions | null>(null);
  private static sliceGeometrySubject = new BehaviorSubject<NgmGeometry | null | undefined>(null);
  private static geomActionSubject = new Subject<GeometryAction>();
  private static syncSliceSubject = new Subject<void>();

  static get slicer(): BehaviorSubject<Slicer | null> {
    return this.slicerSubject;
  }

  static setSlicer(value: Slicer): void {
    this.slicerSubject.next(value);
  }

  static get syncSlice(): Subject<void> {
    return this.syncSliceSubject;
  }

  static nextSliceSync(): void {
    this.syncSliceSubject.next();
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

  static setNoEditGeometries(value: NgmGeometry[]): void {
    this.noEditGeometriesSubject.next(value);
  }

  static get noEditGeometries(): BehaviorSubject<NgmGeometry[]> {
    return this.noEditGeometriesSubject;
  }

  static setOpenedGeometryOptions(value: OpenedGeometryOptions | null): void {
    this.openedGeometryOptionsSubject.next(value);
  }

  static get openedGeometryOptions(): BehaviorSubject<OpenedGeometryOptions | null> {
    return this.openedGeometryOptionsSubject;
  }

  static get openedGeometryOptionsValue(): OpenedGeometryOptions | null {
    return this.openedGeometryOptionsSubject.getValue();
  }

  static get openedGeometry(): NgmGeometry | undefined {
    let geom = this.geometriesSubject
        .getValue()
        .find(geom => geom.id === this.openedGeometryOptionsValue?.id);
    if (!geom) {
      geom = this.noEditGeometriesSubject
          .getValue()
          .find(geom => geom.id === this.openedGeometryOptionsValue?.id);
    }
    return geom;
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
    return this.sliceGeometrySubject.getValue()?.id === this.openedGeometryOptionsValue?.id;
  }

  static get geometryAction(): Subject<GeometryAction> {
    return this.geomActionSubject;
  }

  static nextGeometryAction(value: GeometryAction): void {
    this.geomActionSubject.next(value);
  }
}
