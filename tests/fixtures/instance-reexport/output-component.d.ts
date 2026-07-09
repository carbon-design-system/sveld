import type { Component } from "svelte";

export type InstanceReexportProps = {
  /**
   * Array of data items
   * @default []
   */
  data?: [];

  /**
   * Whether to show details
   * @default false
   */
  showDetails?: boolean;
};

export type InstanceReexportExports = Record<string, never>;

declare const InstanceReexport: Component<
  InstanceReexportProps,
  InstanceReexportExports,
  ""
>;
export default InstanceReexport;
