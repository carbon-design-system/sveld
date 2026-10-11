import { SvelteComponentTyped } from "svelte";

export type MergedContext = {
  a: number;
  b: string;
};

export type WidenedContext = {
  c: boolean;
} & Record<string, any>;

export type ContextSpreadProps = {
  children?: (this: void) => void;
};

export default class ContextSpread extends SvelteComponentTyped<
  ContextSpreadProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
