import { SvelteComponentTyped } from "svelte";

export type CounterContext = {
  /** Current count */
  count: number;
  label: string;
  step: number;
};

export type ContextGetterSetterProps = Record<string, never>;

export default class ContextGetterSetter extends SvelteComponentTyped<
  ContextGetterSetterProps,
  Record<string, any>,
  Record<string, never>
> {}
