<script>
  /**
   * @event {null} open
   * Fired when the menu opens.
   * @event {null} close Fired when the menu closes.
   */

  /**
   * @event {null} select
   * Fired when an item is selected.
   * @slot {{}} item Renders one item.
   */

  /**
   * @event {null} clear
   * Fired when the selection is cleared.
   * @typedef {string} Item An item id.
   */

  import { createEventDispatcher } from "svelte";

  /** @type {Item[]} */
  export let items = [];

  const dispatch = createEventDispatcher();

  $: dispatch("open");
  $: dispatch("close");
  $: dispatch("select");
  $: dispatch("clear");
</script>

{#each items as item}
  <slot
    name="item"
    {item}
  />
{/each}
