import type { Component } from "svelte";

export type BreadcrumbItemContext = Record<string, never>;

export type ContextEmptyProps = Record<string, never>;

export type ContextEmptyExports = Record<string, never>;

declare const ContextEmpty: Component<
  ContextEmptyProps,
  ContextEmptyExports,
  ""
>;
export default ContextEmpty;
