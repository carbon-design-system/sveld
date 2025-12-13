<script>
  /**
   * Breakpoint size names
   * @typedef {"sm" | "md" | "lg" | "xlg" | "max"} BreakpointSize
   * @typedef {320 | 672 | 1056 | 1312 | 1584} BreakpointValue
   * @event change
   * @type {object}
   * @property {BreakpointSize} size
   * @property {BreakpointValue} breakpointValue
   * @slot {{ size: BreakpointSize; sizes: Record<BreakpointSize, boolean>; }}
   */

  /**
   * Event fired when size changes
   * @event resize
   * @event scroll
   */

  /**
   * Event fired when queue is updated
   * @event queue
   * Event fired when item is dequeued from the queue
   * @event dequeue
   * Slot for rendering breakpoint sizes
   * @slot {{ sizes: Record<BreakpointSize, boolean>; }} breakpoint-sizes
   * @slot {{}} break
   * @slot {{ a: 4 }} inline-slot description
   */

  /**
   * Determine the current breakpoint size.
   * @type {BreakpointSize}
   */
  export let size = undefined;

  /**
   * Sizes as an object.
   * @type {Record<BreakpointSize, boolean>}
   */
  export let sizes = {
    sm: false,
    md: false,
    lg: false,
    xlg: false,
    max: false,
  };

  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  $: if (size !== undefined) dispatch("change", { size, breakpointValue: 320 });
</script>

<slot {size} {sizes} />
<slot name="breakpoint-sizes" {sizes} />