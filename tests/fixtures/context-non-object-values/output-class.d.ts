import { SvelteComponentTyped } from "svelte";

export type CountContext = import("svelte/store").Writable<number>;

export type LevelContext = import("svelte/store").Readable<number>;

export type ParentContext = undefined;

export type GroupContext = null;

export type ContextNonObjectValuesProps = {
  children?: (this: void) => void;
};

export default class ContextNonObjectValues extends SvelteComponentTyped<
  ContextNonObjectValuesProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
