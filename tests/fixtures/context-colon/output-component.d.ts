import type { Component } from "svelte";

export type CarbonModalContext = {
  /** Open the modal */
  open: () => void;
  /** Close the modal */
  close: () => void;
};

export type ContextColonProps = Record<string, never>;

export type ContextColonExports = Record<string, never>;

declare const ContextColon: Component<
  ContextColonProps,
  ContextColonExports,
  ""
>;
export default ContextColon;
