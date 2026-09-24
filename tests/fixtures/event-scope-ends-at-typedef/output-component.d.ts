import type { Component } from "svelte";

/**
 * Options desc
 * continued unindented.
 */
export type Options = {
  /** Label desc. */
  label: string;
};

export type EventScopeEndsAtTypedefProps = {
  /**
   * Options desc
   * continued unindented.
   * @default { label: "" }
   */
  options?: Options;

  /**
   * Footer desc
   * continued footer.
   */
  footer?: (this: void) => void;

  /** Go desc. */
  ongo?: (event: CustomEvent<null>) => void;
};

export type EventScopeEndsAtTypedefExports = Record<string, never>;

declare const EventScopeEndsAtTypedef: Component<
  EventScopeEndsAtTypedefProps,
  EventScopeEndsAtTypedefExports,
  ""
>;
export default EventScopeEndsAtTypedef;
