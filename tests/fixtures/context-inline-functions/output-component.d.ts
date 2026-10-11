import type { Component } from "svelte";

export type ModalContext = {
  open: (component: any, props: any) => void;
  close: () => void;
  select: (id: string, focus: boolean) => void;
};

export type ContextInlineFunctionsProps = {
  children?: (this: void) => void;
};

export type ContextInlineFunctionsExports = Record<string, never>;

declare const ContextInlineFunctions: Component<
  ContextInlineFunctionsProps,
  ContextInlineFunctionsExports,
  ""
>;
export default ContextInlineFunctions;
