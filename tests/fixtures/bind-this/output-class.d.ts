import { SvelteComponentTyped } from "svelte";

export type BindThisProps = {
  ref: null | HTMLButtonElement;

  children?: (this: void) => void;
};

export default class BindThis extends SvelteComponentTyped<
  BindThisProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
