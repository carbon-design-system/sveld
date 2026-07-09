import type { Component } from "svelte";

/**
 * Breakpoint size names
 */
export type BreakpointSize = "sm" | "md" | "lg" | "xlg" | "max";

export type BreakpointValue = 320 | 672 | 1056 | 1312 | 1584;

export type TypedefEventSharedBlockProps = {
  /**
   * Determine the current breakpoint size.
   * @default undefined
   */
  size?: BreakpointSize;

  /**
   * Sizes as an object.
   * @default { sm: false, md: false, lg: false, xlg: false, max: false, }
   */
  sizes?: Record<BreakpointSize, boolean>;

  break?: (this: void) => void;

  /** Slot for rendering breakpoint sizes */
  "breakpoint-sizes"?: (this: void, ...args: [{ sizes: Record<BreakpointSize, boolean> }]) => void;

  /** description */
  "inline-slot"?: (this: void, ...args: [{ a: 4 }]) => void;

  children?: (this: void, ...args: [{
        size: BreakpointSize;
        sizes: Record<BreakpointSize, boolean>;
      }]) => void;

  onchange?: (event: CustomEvent<{
        size: BreakpointSize;
        breakpointValue: BreakpointValue;
      }>) => void;

  /** Event fired when item is dequeued from the queue */
  ondequeue?: (event: CustomEvent<null>) => void;

  /** Event fired when queue is updated */
  onqueue?: (event: CustomEvent<null>) => void;

  /** Event fired when size changes */
  onresize?: (event: CustomEvent<null>) => void;

  onscroll?: (event: CustomEvent<null>) => void;
};

export type TypedefEventSharedBlockExports = Record<string, never>;

declare const TypedefEventSharedBlock: Component<
  TypedefEventSharedBlockProps,
  TypedefEventSharedBlockExports,
  ""
>;
export default TypedefEventSharedBlock;
