import { BehaviorSubject } from 'rxjs';
import type { CesiumDraw } from '../draw/CesiumDraw';

export default class DrawStore {
  private static readonly drawSubject = new BehaviorSubject<
    CesiumDraw | undefined
  >(undefined);
  private static readonly drawStateSubject = new BehaviorSubject<boolean>(
    false,
  );
  static readonly measureState = new BehaviorSubject<boolean>(false);

  static setDrawState(value: boolean): void {
    this.drawStateSubject.next(value);
  }

  static get drawState(): BehaviorSubject<boolean> {
    return this.drawStateSubject;
  }

  static get drawStateValue(): boolean {
    return this.drawStateSubject.getValue();
  }

  static setDraw(value: CesiumDraw): void {
    this.drawSubject.next(value);
  }

  static get draw(): BehaviorSubject<CesiumDraw | undefined> {
    return this.drawSubject;
  }

  static get drawValue(): CesiumDraw | undefined {
    return this.drawSubject.getValue();
  }
}
