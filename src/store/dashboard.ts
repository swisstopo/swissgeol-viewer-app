import {BehaviorSubject, Subject} from 'rxjs';
import type {DashboardProject} from '../elements/ngm-dashboard';

export default class DashboardStore {
  private static selectedProjectSubject = new BehaviorSubject<DashboardProject | undefined>(undefined);
  private static viewIndexSubject = new Subject<number | undefined>();

  static get selectedProject(): BehaviorSubject<DashboardProject | undefined> {
    return this.selectedProjectSubject;
  }

  static setSelectedProject(value: DashboardProject | undefined): void {
    this.selectedProjectSubject.next(value);
    if (!value) this.viewIndexSubject.next(undefined);
  }

  static setViewIndex(value: number | undefined): void {
    this.viewIndexSubject.next(value);
  }

  static get viewIndex(): Subject<number | undefined> {
    return this.viewIndexSubject;
  }
}
