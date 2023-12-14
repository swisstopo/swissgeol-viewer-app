import {BehaviorSubject, Subject} from 'rxjs';
import type {Project, Topic} from '../elements/dashboard/ngm-dashboard';
import {NgmGeometry} from '../toolbox/interfaces';
import AuthStore from './auth';

export type TopicParam = { topicId: string, viewId?: string | null }

/**
 * 'edit' - edit from dashboard (create / edit project)
 * 'viewEdit' - view selected and geometries can be edited in the toolbox
 * 'viewOnly' - user has no rights to edit the project
 */
export type ProjectMode = 'edit' | 'viewEdit' | 'viewOnly' | undefined

export default class DashboardStore {
  private static selectedTopicOrProjectSubject = new BehaviorSubject<Topic | Project | undefined>(undefined);
  private static viewIndexSubject = new Subject<number | undefined>();
  private static topicParamSubject = new BehaviorSubject<TopicParam | undefined>(undefined);
  private static projectModeSubject = new BehaviorSubject<ProjectMode>(undefined);
  private static geometriesSubject = new Subject<NgmGeometry[]>();
  private static showSaveOrCancelWarningSubject = new Subject<boolean>();

  static get selectedTopicOrProject(): BehaviorSubject<Topic | Project | undefined> {
    return this.selectedTopicOrProjectSubject;
  }

  static setSelectedTopicOrProject(value: Topic | Project | undefined): void {
    this.selectedTopicOrProjectSubject.next(value);
    if (!value) this.viewIndexSubject.next(undefined);
  }

  static setViewIndex(value: number | undefined): void {
    const projectOrTopic = this.selectedTopicOrProjectSubject.value;
    if (value !== undefined && projectOrTopic) {
      const owner = (<Project> projectOrTopic).owner?.email === AuthStore.userEmail;
      const editor = !!(<Project> projectOrTopic).editors?.find(e => e.email === AuthStore.userEmail);
      this.setProjectMode(owner || editor ? 'viewEdit' : 'viewOnly');
    } else {
      this.setProjectMode(undefined);
    }
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

  static setProjectMode(value: ProjectMode): void {
    this.projectModeSubject.next(value);
  }

  static get projectMode(): BehaviorSubject<ProjectMode> {
    return this.projectModeSubject;
  }

  static setGeometries(geometries: NgmGeometry[]) {
    this.geometriesSubject.next(geometries);
  }

  static get geometriesUpdate() {
    return this.geometriesSubject;
  }

  static showSaveOrCancelWarning(show: boolean) {
    this.showSaveOrCancelWarningSubject.next(show);
  }

  static get onSaveOrCancelWarning() {
    return this.showSaveOrCancelWarningSubject;
  }
}
