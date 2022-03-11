import {BehaviorSubject, Subject} from 'rxjs';
import type {Project, Topic} from '../elements/ngm-dashboard';

export type TopicParam = { topicId: string, viewId?: string | null }

export default class DashboardStore {
  private static selectedTopicOrProjectSubject = new BehaviorSubject<Topic | Project | undefined>(undefined);
  private static viewIndexSubject = new Subject<number | undefined>();
  private static topicParamSubject = new BehaviorSubject<TopicParam | undefined>(undefined);

  static get selectedTopic(): BehaviorSubject<Topic | undefined> {
    return this.selectedTopicOrProjectSubject;
  }

  static setSelectedTopicOrProject(value: Topic | Project | undefined): void {
    this.selectedTopicOrProjectSubject.next(value);
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
