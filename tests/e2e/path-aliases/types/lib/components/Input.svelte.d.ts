import type { SvelteComponentTyped } from "svelte";

export type InputProps = {
  /**
   * Input placeholder
   * @default ""
   */
  placeholder?: string;

  /**
   * Input value
   * @default ""
   */
  value?: string;
};

export default class Input extends SvelteComponentTyped<
  InputProps,
  Record<string, any>,
  Record<string, never>
> {}
