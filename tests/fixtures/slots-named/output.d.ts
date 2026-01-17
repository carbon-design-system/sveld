import { SvelteComponentTyped } from "svelte";

export type SlotsNamedProps = {
  /**
   * @default ""
   */
  text?: string;

  "bold heading"?: (props: { text: string }) => void;

  subheading?: (props: { text: string }) => void;
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
