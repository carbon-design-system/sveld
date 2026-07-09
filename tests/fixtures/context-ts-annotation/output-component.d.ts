import type { Component } from "svelte";

export type AppContext = {
  ctx: { theme: string };
};

export type LegacyContext = {
  jsdocCtx: { label: string };
};

export type ContextTsAnnotationProps = {
  children?: (this: void) => void;
};

export type ContextTsAnnotationExports = Record<string, never>;

declare const ContextTsAnnotation: Component<
  ContextTsAnnotationProps,
  ContextTsAnnotationExports,
  ""
>;
export default ContextTsAnnotation;
