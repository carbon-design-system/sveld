import type { Component } from "svelte";

export type JsdocUnknownTagProps = {
  /**
   * The label.
   * @depreacted Use `text` instead.
   * @default ""
   */
  label?: string;

  /**
   * A custom tag with no close match.
   * @remarks Kept with the description.
   * @default ""
   */
  text?: string;
};

export type JsdocUnknownTagExports = Record<string, never>;

declare const JsdocUnknownTag: Component<
  JsdocUnknownTagProps,
  JsdocUnknownTagExports,
  ""
>;
export default JsdocUnknownTag;
