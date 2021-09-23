import {BehaviorSubject} from 'rxjs';

export default class DrawStore {
  private static drawStateSubject = new BehaviorSubject<boolean>(false)

  static setDrawState(value: boolean): void {
    this.drawStateSubject.next(value);
  }

  static get drawState(): BehaviorSubject<boolean> {
    return this.drawStateSubject;
  }

  static get drawStateValue(): boolean {
    return this.drawStateSubject.getValue();
  }
}
