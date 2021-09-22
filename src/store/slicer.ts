import {BehaviorSubject, Subject} from 'rxjs';
import Slicer from '../slicer/Slicer';

export default class SlicerStore {
  private static slicer = new BehaviorSubject<Slicer | null>(null)
  private static rectangleToCreate = new Subject<any>()

  static getSlicer(): BehaviorSubject<Slicer | null> {
    return this.slicer;
  }

  static setSlicer(value: Slicer): void {
    this.slicer.next(value);
  }

  static get getRectangleToCreate(): Subject<any> {
    return this.rectangleToCreate;
  }

  static setRectangleToCreate(value: Slicer): void {
    this.rectangleToCreate.next(value);
  }
}
