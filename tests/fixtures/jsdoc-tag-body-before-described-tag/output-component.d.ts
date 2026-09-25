import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

/** Rest props go to the wrapper. */
type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  after?: (this: void) => void;

  /**
   * Renders before the list.
   * @example
   * ```svelte
   * <span slot="after">After</span>
   * ```
   */
  before?: (this: void) => void;

  /**
   * Renders the footer.
   * @deprecated Use the body slot.
   */
  footer?: (this: void) => void;

  /** Renders the header. */
  header?: (this: void) => void;

  /** Fired when the menu closes. */
  onclose?: (event: CustomEvent<null>) => void;

  /**
   * @since 1.0
   */
  onopen?: (event: CustomEvent<null>) => void;

  [key: `data-${string}`]: unknown;
};

export type JsdocTagBodyBeforeDescribedTagProps = Omit<$RestProps, keyof $Props> & $Props;

export type JsdocTagBodyBeforeDescribedTagExports = Record<string, never>;

declare const JsdocTagBodyBeforeDescribedTag: Component<
  JsdocTagBodyBeforeDescribedTagProps,
  JsdocTagBodyBeforeDescribedTagExports,
  ""
>;
export default JsdocTagBodyBeforeDescribedTag;
