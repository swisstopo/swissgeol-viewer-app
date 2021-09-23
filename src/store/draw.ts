import {BehaviorSubject, Subject} from 'rxjs';

export default class DrawStore {
  private static drawStateSubject = new BehaviorSubject<boolean>(false)
  private static drawErrorSubject = new Subject<string>()
  private static drawEndSubject = new Subject()
  private static leftUpSubject = new Subject<void>()
  private static leftDownSubject = new Subject<void>()

  static setDrawState(value: boolean): void {
    this.drawStateSubject.next(value);
  }

  static get drawState(): BehaviorSubject<boolean> {
    return this.drawStateSubject;
  }

  static get drawStateValue(): boolean {
    return this.drawStateSubject.getValue();
  }

  static setDrawError(error: string): void {
    this.drawErrorSubject.next(error);
  }

  static get drawError(): Subject<string> {
    return this.drawErrorSubject;
  }

  static triggerDrawEnd(info): void {
    this.drawEndSubject.next(info);
  }

  static get drawEnd(): Subject<any> {
    return this.drawEndSubject;
  }

  static triggerLeftUp(): void {
    this.leftUpSubject.next();
  }

  static get leftUp(): Subject<void> {
    return this.leftUpSubject;
  }

  static triggerLeftDown(): void {
    this.leftDownSubject.next();
  }

  static get leftDown(): Subject<void> {
    return this.leftDownSubject;
  }
}
