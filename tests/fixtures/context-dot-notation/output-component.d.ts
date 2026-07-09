import type { Component } from "svelte";

export type CarbonModalContext = {
  /** Open the modal */
  open: () => void;
  /** Close the modal */
  close: () => void;
};

export type ContextDotNotationProps = Record<string, never>;

export type ContextDotNotationExports = Record<string, never>;

declare const ContextDotNotation: Component<
  ContextDotNotationProps,
  ContextDotNotationExports,
  ""
>;
export default ContextDotNotation;
