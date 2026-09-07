import type { Component } from "svelte";

export type RunesNonIdentifierPropNamesProps = {
  "data-foo": any;

  "123abc": any;

  normal: any;

  "icon-left"?: (this: void) => void;
};

export type RunesNonIdentifierPropNamesExports = Record<string, never>;

declare const RunesNonIdentifierPropNames: Component<
  RunesNonIdentifierPropNamesProps,
  RunesNonIdentifierPropNamesExports,
  ""
>;
export default RunesNonIdentifierPropNames;
