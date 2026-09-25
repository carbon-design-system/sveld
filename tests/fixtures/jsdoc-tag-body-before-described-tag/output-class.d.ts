import { SvelteComponentTyped } from "svelte";
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

  [key: `data-${string}`]: unknown;
};

export type JsdocTagBodyBeforeDescribedTagProps = Omit<$RestProps, keyof $Props> & $Props;

export default class JsdocTagBodyBeforeDescribedTag extends SvelteComponentTyped<
  JsdocTagBodyBeforeDescribedTagProps,
  {
    /** Fired when the menu closes. */
    close: CustomEvent<null>;
    /**
     * @since 1.0
     */
    open: CustomEvent<null>;
  },
  {
    after: Record<string, never>;
    /**
     * Renders before the list.
     * @example
     * ```svelte
     * <span slot="after">After</span>
     * ```
     */
    before: Record<string, never>;
    /**
     * Renders the footer.
     * @deprecated Use the body slot.
     */
    footer: Record<string, never>;
    /** Renders the header. */
    header: Record<string, never>;
  }
> {}
