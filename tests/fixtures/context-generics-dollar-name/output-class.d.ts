import { SvelteComponentTyped } from "svelte";

export type DemoContext<Value$Type extends string> = {
  value: Value$Type;
};

export type ContextGenericsDollarNameProps<Value$Type extends string> = {
  children?: (this: void) => void;
};

export default class ContextGenericsDollarName<Value$Type extends string> extends SvelteComponentTyped<
  ContextGenericsDollarNameProps<Value$Type>,
  Record<string, any>,
  { default: Record<string, never> }
> {}
