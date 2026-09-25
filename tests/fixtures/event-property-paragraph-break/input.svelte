<script>
  /**
   * @event select
   * @type {object}
   * @property {string} id - The selected item's id.
   *
   * Stable across re-renders.
   * @property {number} index - The item's position.
   */

  /**
   * @typedef {object} Range
   * @property {number} start - First index.
   *
   * Inclusive.
   * @property {number} end - Last index.
   */

  import { createEventDispatcher } from "svelte";

  /** @type {Range} */
  export let range = { start: 0, end: 0 };

  const dispatch = createEventDispatcher();

  $: dispatch("select", { id: "a", index: 0 });
</script>
