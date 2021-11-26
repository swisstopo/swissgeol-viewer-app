import {Subject} from 'rxjs';

export default class NavToolsStore {
  private static syncTargetPointSubject = new Subject<void>();
  private static cameraHeightSubject = new Subject<number>();
  private static hideTargetPointSubject = new Subject<void>();


  static get syncTargetPoint() {
    return this.syncTargetPointSubject;
  }

  static nextTargetPointSync() {
    this.syncTargetPointSubject.next();
  }

  static get cameraHeightUpdate(): Subject<number> {
    return this.cameraHeightSubject;
  }

  static setCameraHeight(value: number) {
    this.cameraHeightSubject.next(value);
  }

  static get hideTargetPointListener() {
    return this.hideTargetPointSubject;
  }

  static hideTargetPoint() {
    this.hideTargetPointSubject.next();
  }

}
