import type { Component } from "svelte";

export type Header = {
  /**
   * The intended next sort direction,
   * reported regardless.
   */
  dir?: "ascending"
  | "descending"
  | "none";
  /** Description on the line after the type. */
  prev?: "ascending"
  | "descending";
};

/**
 * Props of any component,
 * spread onto the root.
 */
export type Aliased = import("svelte").ComponentProps<
  import("svelte").SvelteComponent>;

export type Size = "sm"
| "lg";

export type Formatter = (value: string
  | number) => string
| undefined;

export type JsdocMultilineTypeDescriptionProps = {
  /**
   * @default {}
   */
  header?: Header;

  /**
   * Props of any component,
   * spread onto the root.
   * @default {}
   */
  aliased?: Aliased;

  /**
   * @default "sm"
   */
  size?: Size;

  /**
   * @default (value) => String(value)
   */
  formatter?: Formatter;

  footer?: (this: void) => void;

  /**
   * Renders one item,
   * with its props.
   */
  item?: (this: void, ...args: [{
        item: string;
        index: number
      }]) => void;

  onclose?: (event: CustomEvent<null>) => void;

  /**
   * Fired when a row is selected,
   * with its position.
   */
  onselect?: (event: CustomEvent<{
        id: string;
        index: number
      }>) => void;
};

export type JsdocMultilineTypeDescriptionExports = {
  /**
   * Formats a value.
   */
  format: (value: string
    | number) => string
  | undefined;
};

declare const JsdocMultilineTypeDescription: Component<
  JsdocMultilineTypeDescriptionProps,
  JsdocMultilineTypeDescriptionExports,
  ""
>;
export default JsdocMultilineTypeDescription;
