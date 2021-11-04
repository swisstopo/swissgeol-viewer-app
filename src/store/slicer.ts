import {BehaviorSubject, Subject} from 'rxjs';
import Slicer from '../slicer/Slicer';

export default class SlicerStore {
  private static slicerSubject = new BehaviorSubject<Slicer | null>(null);
  private static rtcSubject = new Subject<any>();

  static get slicer(): BehaviorSubject<Slicer | null> {
    return this.slicerSubject;
  }

  static setSlicer(value: Slicer): void {
    this.slicerSubject.next(value);
  }

  static get rectangleToCreate(): Subject<any> {
    return this.rtcSubject;
  }

  static setRectangleToCreate(value: Slicer): void {
    this.rtcSubject.next(value);
  }
}
