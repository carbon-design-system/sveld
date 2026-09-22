import type { Component } from "svelte";

export type CallExpressionDefaultUnresolvableImportProps = {
  /**
   * @default generateId()
   */
  id?: any;
};

export type CallExpressionDefaultUnresolvableImportExports = Record<string, never>;

declare const CallExpressionDefaultUnresolvableImport: Component<
  CallExpressionDefaultUnresolvableImportProps,
  CallExpressionDefaultUnresolvableImportExports,
  ""
>;
export default CallExpressionDefaultUnresolvableImport;
