import {Id} from 'src/models/id.model';

export interface Model {
  id: Id<this>
}

export const makeModelMapping = <T extends Model>(records: Iterable<T>): Map<Id<T>, T> => {
  const mapping = new Map<Id<T>, T>();
  for (const record of records) {
    mapping.set(record.id, record);
  }
  return mapping;
};
