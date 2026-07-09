import type { Component } from "svelte";

export type ForwardedStandardEventCustomDetailProps = {
  /**
   * @default []
   */
  files?: [];

  onadd?: (event: CustomEvent<ReadonlyArray<File>>) => void;

  onchange?: (event: CustomEvent<ReadonlyArray<File>>) => void;

  onremove?: (event: CustomEvent<ReadonlyArray<File>>) => void;
};

export type ForwardedStandardEventCustomDetailExports = Record<string, never>;

declare const ForwardedStandardEventCustomDetail: Component<
  ForwardedStandardEventCustomDetailProps,
  ForwardedStandardEventCustomDetailExports,
  ""
>;
export default ForwardedStandardEventCustomDetail;
