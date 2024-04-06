import type { SvelteComponentTyped } from "svelte";

export interface BindThisProps {
  /**
   * @default undefined
   */
  ref: null | HTMLButtonElement;
}

export default class BindThis extends SvelteComponentTyped<BindThisProps, Record<string, any>, { default: {} }> {}
