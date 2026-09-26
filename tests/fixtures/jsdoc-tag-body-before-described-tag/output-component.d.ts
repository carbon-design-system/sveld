import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";
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

export type JsdocTagBodyBeforeDescribedTagExports = Record<string, never>;

type $Events = {
  /** Fired when the menu closes. */
  close: CustomEvent<null>;
  /**
   * @since 1.0
   */
  open: CustomEvent<null>;
};

interface JsdocTagBodyBeforeDescribedTagComponent {
  new (
    options: ComponentConstructorOptions<JsdocTagBodyBeforeDescribedTagProps>
  ): SvelteComponent<JsdocTagBodyBeforeDescribedTagProps, $Events> & JsdocTagBodyBeforeDescribedTagExports;
  (
    this: void,
    internals: ComponentInternals,
    props: JsdocTagBodyBeforeDescribedTagProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<JsdocTagBodyBeforeDescribedTagProps>): void;
  } & JsdocTagBodyBeforeDescribedTagExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const JsdocTagBodyBeforeDescribedTag: JsdocTagBodyBeforeDescribedTagComponent;
export default JsdocTagBodyBeforeDescribedTag;
