import { BehaviorSubject, Subject } from 'rxjs';
import type { LockType } from '../elements/ngm-cam-configuration';
import type { Cartesian3 } from 'cesium';

export default class NavToolsStore {
  private static readonly syncTargetPointSubject = new Subject<void>();
  private static readonly cameraHeightSubject = new Subject<number>();
  private static readonly hideTargetPointSubject = new Subject<void>();
  private static readonly navLockTypeSubject = new BehaviorSubject<LockType>(
    '',
  );
  private static readonly targetPointPositionSubject = new BehaviorSubject<
    Cartesian3 | undefined
  >(undefined);
  static readonly exaggerationChanged = new Subject<number>();

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

  static get targetPointPosition(): BehaviorSubject<Cartesian3 | undefined> {
    return this.targetPointPositionSubject;
  }

  static get targetPointPositionValue(): Cartesian3 | undefined {
    return this.targetPointPositionSubject.getValue();
  }

  static setTargetPointPosition(value) {
    this.targetPointPositionSubject.next(value);
  }
}
