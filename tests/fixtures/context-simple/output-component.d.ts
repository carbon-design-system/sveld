import type { Component } from "svelte";

export type SimpleModalContext = {
  /** Open the modal with content */
  open: (component: any, props?: any) => void;
  /** Close the modal */
  close: () => void;
};

export type ContextSimpleProps = {
  children?: (this: void) => void;
};

export type ContextSimpleExports = Record<string, never>;

declare const ContextSimple: Component<
  ContextSimpleProps,
  ContextSimpleExports,
  ""
>;
export default ContextSimple;
