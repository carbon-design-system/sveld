import type { Component } from "svelte";

export type JsdocTypeSyntaxErrorProps = {
  /**
   * @default []
   */
  closure?: any;

  /**
   * @default ""
   */
  truncated?: any;
};

export type JsdocTypeSyntaxErrorExports = Record<string, never>;

declare const JsdocTypeSyntaxError: Component<
  JsdocTypeSyntaxErrorProps,
  JsdocTypeSyntaxErrorExports,
  ""
>;
export default JsdocTypeSyntaxError;
