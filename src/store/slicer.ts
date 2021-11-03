import {BehaviorSubject, Subject} from 'rxjs';
import Slicer from '../slicer/Slicer';
import {NgmGeometry} from '../toolbox/ngm-aoi-drawer';

export default class SlicerStore {
  private static slicerSubject = new BehaviorSubject<Slicer | null>(null)
  private static rtcSubject = new Subject<any>()

  static get slicer(): BehaviorSubject<Slicer | null> {
    return this.slicerSubject;
  }

  static setSlicer(value: Slicer): void {
    this.slicerSubject.next(value);
  }

  static get rectangleToCreate(): Subject<any> {
    return this.rtcSubject;
  }

  static setRectangleToCreate(value: NgmGeometry): void {
    this.rtcSubject.next(value);
  }
}
