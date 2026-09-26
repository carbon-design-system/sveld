import type { Component } from "svelte";

export type CustomElementObjectConfigProps = {
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

export type CustomElementObjectConfigExports = Record<string, never>;

declare const CustomElementObjectConfig: Component<
  CustomElementObjectConfigProps,
  CustomElementObjectConfigExports,
  ""
>;
export default CustomElementObjectConfig;
