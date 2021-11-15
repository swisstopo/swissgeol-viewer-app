import {Subject} from 'rxjs';

export default class QueryStore {
  private static objectInfoSubject = new Subject<any>();

  static setObjectInfo(attributes: any): void {
    if (attributes && !Object.getOwnPropertyNames(attributes).length)
      attributes = null;
    this.objectInfoSubject.next(attributes);
  }

  static get objectInfo(): Subject<any> {
    return this.objectInfoSubject;
  }
}
