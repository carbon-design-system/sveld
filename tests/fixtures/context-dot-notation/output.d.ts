import { SvelteComponentTyped } from "svelte";

export type CarbonModalContext = {
  /** Open the modal */
  open: () => void;
  /** Close the modal */
  close: () => void;
};

export type ContextDotNotationProps = Record<string, never>;

export default class ContextDotNotation extends SvelteComponentTyped<
  ContextDotNotationProps,
  Record<string, any>,
  Record<string, never>
> {}
