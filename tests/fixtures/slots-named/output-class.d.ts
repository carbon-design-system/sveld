import { SvelteComponentTyped } from "svelte";

export type SlotsNamedProps = {
  /**
   * @default ""
   */
  text?: string;

  "bold heading"?: (this: void, ...args: [{ text: string }]) => void;

  subheading?: (this: void, ...args: [{ text: string }]) => void;

  children?: (this: void) => void;
};

export default class SlotsNamed extends SvelteComponentTyped<
  SlotsNamedProps,
  Record<string, any>,
  {
    default: Record<string, never>;
    "bold heading": { text: string };
    subheading: { text: string };
    text: { text: string };
  }
> {}
