import type { SvelteComponentTyped } from "svelte";

export interface InputProps {
  /**
   * @default ""
   */
  text?: string;
}

export default class Input extends SvelteComponentTyped<
  InputProps,
  Record<string, any>,
  { default: {}; ["bold heading"]: { text: string }; subheading: { text: string }; text: { text: string } }
> {}
