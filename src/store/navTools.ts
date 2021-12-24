import {BehaviorSubject, Subject} from 'rxjs';
import type {LockType} from '../elements/ngm-cam-configuration';

export default class NavToolsStore {
  private static syncTargetPointSubject = new Subject<void>();
  private static cameraHeightSubject = new Subject<number>();
  private static hideTargetPointSubject = new Subject<void>();
  private static navLockTypeSubject = new BehaviorSubject<LockType>('');


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

  static get navLockType(): BehaviorSubject<LockType> {
    return this.navLockTypeSubject;
  }

  static get navLockTypeValue(): LockType {
    return this.navLockTypeSubject.getValue();
  }

  static setNavLockType(value) {
    this.navLockTypeSubject.next(value);
  }

}
