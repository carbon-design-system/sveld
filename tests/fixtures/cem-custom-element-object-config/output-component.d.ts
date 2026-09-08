import type { Component } from "svelte";

export type CemCustomElementObjectConfigProps = {
  /**
   * @default "default"
   */
  variant?: string;

  /**
   * @default false
   */
  active?: boolean;

  /**
   * @default []
   */
  tags?: string[];
};

export type CemCustomElementObjectConfigExports = Record<string, never>;

declare const CemCustomElementObjectConfig: Component<
  CemCustomElementObjectConfigProps,
  CemCustomElementObjectConfigExports,
  ""
>;
export default CemCustomElementObjectConfig;
