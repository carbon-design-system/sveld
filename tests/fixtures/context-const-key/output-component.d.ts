import type { Component } from "svelte";

export type SimpleModalContext = {
  /** Open the modal with content */
  open: (component: any, props?: any) => void;
  /** Close the modal */
  close: () => void;
};

export type ContextConstKeyProps = {
  children?: (this: void) => void;
};

export type ContextConstKeyExports = Record<string, never>;

declare const ContextConstKey: Component<
  ContextConstKeyProps,
  ContextConstKeyExports,
  ""
>;
export default ContextConstKey;
