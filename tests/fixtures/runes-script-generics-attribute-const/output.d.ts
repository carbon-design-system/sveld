import { SvelteComponentTyped } from "svelte";

type $Props<const T extends readonly string[]> = { items: T } & {
  children?: (this: void) => void;
};

export type RunesScriptGenericsAttributeConstProps<const T extends readonly string[]> = $Props<T>;

export default class RunesScriptGenericsAttributeConst<const T extends readonly string[]> extends SvelteComponentTyped<
  RunesScriptGenericsAttributeConstProps<T>,
  Record<string, any>,
  { default: Record<string, never> }
> {}
