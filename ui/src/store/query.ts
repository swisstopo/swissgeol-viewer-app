import { Subject } from 'rxjs';
import type { QueryResult } from '../query/types';

export default class QueryStore {
  private static readonly objectInfoSubject = new Subject<
    QueryResult | undefined
  >();

  static setObjectInfo(attributes: QueryResult | undefined): void {
    if (attributes && !Object.getOwnPropertyNames(attributes).length)
      attributes = undefined;
    this.objectInfoSubject.next(attributes);
  }

  static get objectInfo(): Subject<QueryResult | undefined> {
    return this.objectInfoSubject;
  }
}
