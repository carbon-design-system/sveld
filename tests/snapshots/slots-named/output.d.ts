/// <reference types="svelte" />
import { SvelteComponent } from "svelte";

export interface InputProps {
  /**
   * @default ""
   */
  text?: string;
}

export default class Input extends SvelteComponent<
  InputProps,
  {},
  { default: {}; ["bold heading"]: { text: string }; subheading: { text: string }; text: { text: string } }
> {}
