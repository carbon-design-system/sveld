import type { SvelteComponentTyped } from "svelte";

export type SlotsNamedProps = {
  /**
   * @default ""
   */
  text?: string;
};

export default class SlotsNamed extends SvelteComponentTyped<
  SlotsNamedProps,
  Record<string, any>,
  { default: {}; ["bold heading"]: { text: string }; subheading: { text: string }; text: { text: string } }
> {}
