import type { Component } from "svelte";

export { tokTypes } from "acorn";

export type ModuleReexportProps = {
  /**
   * Chart data to display
   * @default null
   */
  data?: any;

  /**
   * Chart title
   * @default "Chart"
   */
  title?: string;

  children?: (this: void) => void;
};

export type ModuleReexportExports = Record<string, never>;

declare const ModuleReexport: Component<
  ModuleReexportProps,
  ModuleReexportExports,
  ""
>;
export default ModuleReexport;
