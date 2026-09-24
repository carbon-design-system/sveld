import type { Component } from "svelte";

export type InstanceExportConstFunctionJsdocProps = {
  /**
   * @default 1
   */
  size?: number;
};

export type InstanceExportConstFunctionJsdocExports = {
  /**
   * Formats a value.
   */
  format: (value: string) => string;

  identity: <T>(value: T) => T;
};

declare const InstanceExportConstFunctionJsdoc: Component<
  InstanceExportConstFunctionJsdocProps,
  InstanceExportConstFunctionJsdocExports,
  ""
>;
export default InstanceExportConstFunctionJsdoc;
