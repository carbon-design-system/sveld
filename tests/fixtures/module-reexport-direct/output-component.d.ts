import type { Component } from "svelte";

export type ModuleReexportDirectProps = {
  /**
   * Configuration settings
   * @default { enabled: true }
   */
  config?: { enabled: true };

  /**
   * Optional callback function
   * @default undefined
   */
  onReady: undefined;

  header?: (this: void) => void;

  children?: (this: void) => void;
};

export type ModuleReexportDirectExports = Record<string, never>;

declare const ModuleReexportDirect: Component<
  ModuleReexportDirectProps,
  ModuleReexportDirectExports,
  ""
>;
export default ModuleReexportDirect;
