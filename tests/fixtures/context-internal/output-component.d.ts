import type { Component } from "svelte";

export type PublicContext = {
  open: boolean;
};

export type ContextInternalProps = {
  children?: (this: void) => void;
};

export type ContextInternalExports = Record<string, never>;

declare const ContextInternal: Component<
  ContextInternalProps,
  ContextInternalExports,
  ""
>;
export default ContextInternal;
