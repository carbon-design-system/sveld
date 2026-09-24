import type { Component } from "svelte";

export type JsdocBracedTagTextProps = {
  /**
   * Options.
   * @default { a: 1, b: 2 }
   */
  options?: {};

  /**
   * Old prop.
   * @deprecated {@link newProp} replaces this.
   * @default 1
   */
  oldProp?: number;

  /**
   * Older prop.
   * @deprecated Use newProp,
   *   which is faster.
   * @default 1
   */
  olderProp?: number;

  /**
   * @deprecated {@link body} replaces this slot.
   */
  header?: (this: void) => void;
};

export type JsdocBracedTagTextExports = Record<string, never>;

declare const JsdocBracedTagText: Component<
  JsdocBracedTagTextProps,
  JsdocBracedTagTextExports,
  ""
>;
export default JsdocBracedTagText;
