<script>
  import { createEventDispatcher } from "svelte";

  /**
   * @typedef {object} Attributes
   * @property {string} data-id The element's data id.
   * @property {boolean} aria-hidden
   */

  /**
   * @event select
   * @property {string} item-id The selected item's id.
   * @property {number} [index]
   */

  const dispatch = createEventDispatcher();

  $: dispatch("change", { "a-b": 1, ok: true, 3: "three", "with space": "x" });
  $: dispatch("select", { "item-id": "1" });
</script>

<div />
