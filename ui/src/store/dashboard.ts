import {BehaviorSubject, Subject} from 'rxjs';
import type {Project, Topic} from '../elements/dashboard/ngm-dashboard';
import {NgmGeometry} from '../toolbox/interfaces';

export type TopicParam = { topicId: string, viewId?: string | null }

export default class DashboardStore {
  private static selectedTopicOrProjectSubject = new BehaviorSubject<Topic | Project | undefined>(undefined);
  private static viewIndexSubject = new BehaviorSubject<number | undefined>(undefined);
  private static topicParamSubject = new BehaviorSubject<TopicParam | undefined>(undefined);
  private static editModeSubject = new BehaviorSubject<boolean>(false);
  private static geometriesSubject = new Subject<NgmGeometry[]>();

  static get selectedTopicOrProject(): BehaviorSubject<Topic | Project | undefined> {
    return this.selectedTopicOrProjectSubject;
  }

  static setSelectedTopicOrProject(value: Topic | Project | undefined): void {
    this.selectedTopicOrProjectSubject.next(value);
    if (!value) this.viewIndexSubject.next(undefined);
  }

  static setViewIndex(value: number | undefined): void {
    this.setEditMode(value !== undefined);
    this.viewIndexSubject.next(value);
  }

  static get viewIndex(): BehaviorSubject<number | undefined> {
    return this.viewIndexSubject;
  }

  static setTopicParam(value: TopicParam) {
    this.topicParamSubject.next(value);
  }

  static get topicParam(): BehaviorSubject<TopicParam | undefined> {
    return this.topicParamSubject;
  }

  static setEditMode(value: boolean): void {
    this.editModeSubject.next(value);
  }

  static get editMode(): BehaviorSubject<boolean> {
    return this.editModeSubject;
  }

  static setGeometries(geometries: NgmGeometry[]) {
    this.geometriesSubject.next(geometries);
  }

  static get geometriesUpdate() {
    return this.geometriesSubject;
  }
}
