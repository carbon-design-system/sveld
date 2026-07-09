export interface StringWrap {
  text: string;
}
export interface ObjectWrap<T> {
  value: T;
}
export type Wrapped<T> = T extends string ? StringWrap : ObjectWrap<T>;
export interface Props<T> {
  item: T;
  wrapped: Wrapped<T>;
  keys: keyof T;
}
