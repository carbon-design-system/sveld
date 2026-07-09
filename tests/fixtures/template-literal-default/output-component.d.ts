import type { Component } from "svelte";

export type TemplateLiteralDefaultProps = {
  /**
   * Template literal with call expression
   * @default `ccs-${Math.random().toString(36)}`
   */
  id?: string;

  /**
   * Static template literals
   * @default `prefix-`
   */
  prefix?: string;

  /**
   * @default `-suffix`
   */
  suffix?: string;

  /**
   * Template literal with multiple expressions
   * @default `Hello, ${"world"}! Count: ${42}`
   */
  message?: string;
};

export type TemplateLiteralDefaultExports = Record<string, never>;

declare const TemplateLiteralDefault: Component<
  TemplateLiteralDefaultProps,
  TemplateLiteralDefaultExports,
  ""
>;
export default TemplateLiteralDefault;
