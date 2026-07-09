import type { Component } from "svelte";

export type ModuleReexportProps = {
  /**
   * Chart data to display
   * @default null
   */
  data?: undefined;

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
