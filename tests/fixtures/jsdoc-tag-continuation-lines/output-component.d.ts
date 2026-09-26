import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type Config = {
  /**
   * Height of each item in pixels, used for
   * virtualization math.
   */
  itemHeight: number;
  /**
   * Rows rendered outside the viewport,
   * above and below it.
   */
  overscan?: number;
  sticky?: boolean;
};

export type JsdocTagContinuationLinesProps = {
  /**
   * @default { itemHeight: 1 }
   */
  config?: Config;

  footer?: (this: void) => void;

  /**
   * Renders one item,
   * with its props.
   */
  item?: (this: void, ...args: [{ item: string }]) => void;
};

export type JsdocTagContinuationLinesExports = {
  /**
   * Formats a value.
   */
  format: (value: string) => string;
};

type $Events = {
  /** Fired when the page changes. */
  change: CustomEvent<{
      /**
       * The new page, counted
       * from one.
       */
      page: number;
      pageSize: number;
    }>;
  /** Fired when a row is selected. */
  select: CustomEvent<{
      /**
       * The selected id,
       * never empty.
       */
      id: string;
      index: number;
    }>;
};

interface JsdocTagContinuationLinesComponent {
  new (
    options: ComponentConstructorOptions<JsdocTagContinuationLinesProps>
  ): SvelteComponent<JsdocTagContinuationLinesProps, $Events> & JsdocTagContinuationLinesExports;
  (
    this: void,
    internals: ComponentInternals,
    props: JsdocTagContinuationLinesProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<JsdocTagContinuationLinesProps>): void;
  } & JsdocTagContinuationLinesExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const JsdocTagContinuationLines: JsdocTagContinuationLinesComponent;
export default JsdocTagContinuationLines;
