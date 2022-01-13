import {BehaviorSubject, Subject} from 'rxjs';
import type {SelectedView} from '../elements/ngm-dashboard';

export default class DashboardStore {
  private static selectedViewSubject = new BehaviorSubject<SelectedView | undefined>(undefined);
  private static viewIndexSubject = new Subject<number>();

  static get selectedView(): BehaviorSubject<SelectedView | undefined> {
    return this.selectedViewSubject;
  }

  static get selectedViewValue(): SelectedView | undefined {
    return this.selectedViewSubject.getValue();
  }

  static setSelectedView(value: SelectedView): void {
    this.selectedViewSubject.next(value);
  }

  static setViewIndex(value: number): void {
    this.viewIndexSubject.next(value);
  }

  static get viewIndex(): Subject<number> {
    return this.viewIndexSubject;
  }
}
