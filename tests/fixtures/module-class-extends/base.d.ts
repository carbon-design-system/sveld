export declare class Base<T> {
  value: T;
  constructor(value: T);
}

export interface Disposable {
  dispose(): void;
}

export interface Named {
  name: string;
}
