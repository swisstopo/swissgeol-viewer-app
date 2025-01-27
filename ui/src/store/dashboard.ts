import { BehaviorSubject, Subject } from 'rxjs';
import type { Project, Topic } from '../elements/dashboard/ngm-dashboard';
import { NgmGeometry } from '../toolbox/interfaces';
import { isProjectOwnerOrEditor } from '../elements/dashboard/helpers';

export type TopicParam = { topicId: string; viewId?: string | null };
export type ProjectParam = { projectId: string; viewId?: string | null };

export type TopicParamSubject = {
  kind: 'topic';
  param: TopicParam;
};

export type ProjectParamSubject = {
  kind: 'project';
  param: ProjectParam;
};

/**
 * 'edit' - edit from dashboard (create / edit project)
 * 'viewEdit' - view selected and geometries can be edited in the toolbox
 * 'viewOnly' - user has no rights to edit the project
 */
export type ProjectMode = 'edit' | 'viewEdit' | 'viewOnly' | undefined;

export default class DashboardStore {
  private static readonly selectedTopicOrProjectSubject = new BehaviorSubject<
    Topic | Project | undefined
  >(undefined);
  private static readonly viewIndexSubject = new Subject<number | undefined>();
  private static readonly topicOrProjectParamSubject = new BehaviorSubject<
    TopicParamSubject | ProjectParamSubject | undefined
  >(undefined);
  private static readonly projectModeSubject = new BehaviorSubject<ProjectMode>(
    undefined,
  );
  private static readonly geometriesSubject = new Subject<NgmGeometry[]>();
  private static readonly showSaveOrCancelWarningSubject =
    new Subject<boolean>();

  static get selectedTopicOrProject(): BehaviorSubject<
    Topic | Project | undefined
  > {
    return this.selectedTopicOrProjectSubject;
  }

  static setSelectedTopicOrProject(value: Topic | Project | undefined): void {
    this.selectedTopicOrProjectSubject.next(value);
    if (!value) this.setViewIndex(undefined);
  }

  static setViewIndex(value: number | undefined): void {
    const projectOrTopic = this.selectedTopicOrProjectSubject.value;
    if (value !== undefined && projectOrTopic) {
      const mode = isProjectOwnerOrEditor(projectOrTopic)
        ? 'viewEdit'
        : 'viewOnly';
      if (this.projectMode.value !== mode) this.setProjectMode(mode);
    } else {
      this.setProjectMode(undefined);
    }
    this.viewIndexSubject.next(value);
  }

  static get viewIndex(): Subject<number | undefined> {
    return this.viewIndexSubject;
  }

  static setTopicOrProjectParam(
    value: TopicParamSubject | ProjectParamSubject,
  ) {
    this.topicOrProjectParamSubject.next(value);
  }

  static get topicOrProjectParam(): BehaviorSubject<
    TopicParamSubject | ProjectParamSubject | undefined
  > {
    return this.topicOrProjectParamSubject;
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
