<script>
  /**
   * @event {{ value: string }} select
   * Fired when the user selects an item.
   * @event {null} clear
   */

  /**
   * @event {{ value: string }} open
   *   Fired when the menu opens.
   * @event {null} close
   */

  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();
</script>

<button
  on:click={() => {
    dispatch("select", { value: "a" });
    dispatch("clear", null);
    dispatch("open", { value: "a" });
    dispatch("close", null);
  }}
>
  Menu
</button>
