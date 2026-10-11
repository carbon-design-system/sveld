import { SvelteComponentTyped } from "svelte";

export type SvelteOptionsRunesFalseProps = {
  /**
   * @default "Save"
   */
  label?: string;
};

export default class SvelteOptionsRunesFalse extends SvelteComponentTyped<
  SvelteOptionsRunesFalseProps,
  Record<string, any>,
  Record<string, never>
> {}
