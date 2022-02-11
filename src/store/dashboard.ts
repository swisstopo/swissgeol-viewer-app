import {BehaviorSubject, Subject} from 'rxjs';
import type {DashboardProject} from '../elements/ngm-dashboard';

export type TopicParam = { topicId: string, viewId?: string | null }

export default class DashboardStore {
  private static selectedProjectSubject = new BehaviorSubject<DashboardProject | undefined>(undefined);
  private static viewIndexSubject = new Subject<number | undefined>();
  private static topicParamSubject = new BehaviorSubject<TopicParam | undefined>(undefined);

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

  static setTopicParam(value: TopicParam) {
    this.topicParamSubject.next(value);
  }

  static get topicParam(): BehaviorSubject<TopicParam | undefined> {
    return this.topicParamSubject;
  }
}
