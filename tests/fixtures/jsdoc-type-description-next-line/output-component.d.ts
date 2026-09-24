import type { Component } from "svelte";

export type JsdocTypeDescriptionNextLineProps = {
  /** Header content. */
  header?: (this: void, ...args: [{ title: string }]) => void;

  /** Renders each item. */
  children?: (this: void, ...args: [{ item: string }]) => void;

  /** Fired on change. */
  onchange?: (event: CustomEvent<{ value: string }>) => void;
};

export type JsdocTypeDescriptionNextLineExports = Record<string, never>;

declare const JsdocTypeDescriptionNextLine: Component<
  JsdocTypeDescriptionNextLineProps,
  JsdocTypeDescriptionNextLineExports,
  ""
>;
export default JsdocTypeDescriptionNextLine;
