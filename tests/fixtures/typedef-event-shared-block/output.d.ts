import { SvelteComponentTyped } from "svelte";

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

  break?: () => void;

  /** Slot for rendering breakpoint sizes */
  "breakpoint-sizes"?: () => void;

  /** description */
  "inline-slot"?: () => void;
};

export default class TypedefEventSharedBlock extends SvelteComponentTyped<
  TypedefEventSharedBlockProps,
  {
    change: CustomEvent<{ size: BreakpointSize; breakpointValue: BreakpointValue }>;
    /** Event fired when size changes */
    resize: CustomEvent<null>;
    scroll: CustomEvent<null>;
    /** Event fired when item is dequeued from the queue */
    queue: CustomEvent<null>;
    /** Slot for rendering breakpoint sizes */
    dequeue: CustomEvent<null>;
  },
  {
    default: { size: BreakpointSize; sizes: Record<BreakpointSize, boolean> };
    break: Record<string, never>;
    /** Slot for rendering breakpoint sizes */
    "breakpoint-sizes": { sizes: Record<BreakpointSize, boolean> };
    /** description */
    "inline-slot": { a: 4 };
  }
> {}
