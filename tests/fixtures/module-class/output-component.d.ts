import type { Component } from "svelte";
import type { Options } from "./types";

/**
 * A value holder.
 * @since 1.2.0
 */
export declare class Store<T extends object = Record<string, unknown>> {
  /**
   * Current value.
   */
  value: T;

  static readonly count: number;

  label?: string;

  constructor(initial: T, name?: any, options?: Options);

  readonly name: any;

  /**
   * Creates a store.
   */
  static create<U extends object>(value: U): Store<U>;

  /**
   * Subscribes to changes.
   * @deprecated Use `listen` instead.
   */
  subscribe(run: (value: T) => void): () => void;

  snapshot(): Snapshot<T>;

  format(value: string): string;

  format(value: number): string;

  load(...keys: string[]): Promise<any>;

  readonly size: number;

  mode: "a" | "b";

  maybe?(): void;
}

export declare abstract class Base {
  abstract run(): void;

  abstract readonly id: string;
}

interface Snapshot<T> {
  value: T;
  at: number;
}

export type ModuleClassProps = {
  store: Store<{ id: string }>;
};

export type ModuleClassExports = Record<string, never>;

declare const ModuleClass: Component<
  ModuleClassProps,
  ModuleClassExports,
  ""
>;
export default ModuleClass;
