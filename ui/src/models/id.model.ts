
export type Id<_T> = (string | number) & {
  readonly __id__: unique symbol
}


export function makeId<T>(id: string | number): Id<T>
export function makeId<T>(id: string | number | null): Id<T> | null
export function makeId<T>(id: string | number | null): Id<T> | null {
  return id as Id<T> | null;
}
