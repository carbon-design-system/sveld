import { SvelteComponentTyped } from "svelte";

export type SlotsSpreadProps = {
  text?: (this: void) => void;

  children?: (this: void) => void;
};

export default class SlotsSpread extends SvelteComponentTyped<
  SlotsSpreadProps,
  Record<string, any>,
  { default: Record<string, never>; text: Record<string, never> }
> {}
