import type { Component } from "svelte";

export type EmptyExportProps = Record<string, never>;

export type EmptyExportExports = Record<string, never>;

declare const EmptyExport: Component<
  EmptyExportProps,
  EmptyExportExports,
  ""
>;
export default EmptyExport;
