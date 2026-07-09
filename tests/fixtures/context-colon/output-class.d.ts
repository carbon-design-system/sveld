import { SvelteComponentTyped } from "svelte";

export type CarbonModalContext = {
  /** Open the modal */
  open: () => void;
  /** Close the modal */
  close: () => void;
};

export type ContextColonProps = Record<string, never>;

export default class ContextColon extends SvelteComponentTyped<
  ContextColonProps,
  Record<string, any>,
  Record<string, never>
> {}
