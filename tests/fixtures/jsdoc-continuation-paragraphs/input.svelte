<script>
  /**
   * @event {null} open
   *   Fired when the menu opens.
   *
   *   Not fired on the first render.
   * @event {null} close
   */

  /**
   * @typedef {object} Item
   * @property {string} id The item id.
   *
   *   Unique within one menu.
   * @typedef {number} Count
   */

  /**
   * The menu's placement.
   *
   * Flips when there's no room.
   * @typedef {"top" | "bottom"} Placement
   */

  /**
   * @slot {{ item: Item }} item Renders one item.
   *
   *   For example:
   *   ```svelte
   *   {#if item.id}
   *     <b>{item.id}</b>
   *   {/if}
   *   ```
   * @slot {{}} footer
   */

  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  /** @type {Item[]} */
  export let items = [];

  /**
   * Formats an item.
   * @param {Item} item The item to format.
   *
   *   Returns an empty string for an item without an id:
   *   ```js
   *   if (!item.id) {
   *     return "";
   *   }
   *   ```
   * @returns {string}
   */
  export function format(item) {
    dispatch("open", null);
    dispatch("close", null);
    return item.id;
  }
</script>

{#each items as item}
  <slot
    name="item"
    {item}
  />
{/each}
<slot name="footer" />
