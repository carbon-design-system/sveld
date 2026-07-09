import type { Component } from "svelte";

export type SlotsNamedProps = {
  /**
   * @default ""
   */
  text?: string;

  "bold heading"?: (this: void, ...args: [{ text: string }]) => void;

  subheading?: (this: void, ...args: [{ text: string }]) => void;

  children?: (this: void) => void;
};

export type SlotsNamedExports = Record<string, never>;

declare const SlotsNamed: Component<
  SlotsNamedProps,
  SlotsNamedExports,
  ""
>;
export default SlotsNamed;
