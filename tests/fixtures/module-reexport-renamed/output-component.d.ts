import type { Component } from "svelte";

export type ModuleReexportRenamedProps = {
  /**
   * Controls visibility
   * @default true
   */
  visible?: boolean;

  /**
   * Configuration object
   * @default {}
   */
  config?: {};

  children?: (this: void) => void;
};

export type ModuleReexportRenamedExports = Record<string, never>;

declare const ModuleReexportRenamed: Component<
  ModuleReexportRenamedProps,
  ModuleReexportRenamedExports,
  ""
>;
export default ModuleReexportRenamed;
