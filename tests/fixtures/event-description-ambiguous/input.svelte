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

  /**
   * @event {null} focus
   *   Fired when the menu gains focus.
   * Fired when the menu loses focus.
   * @event {null} blur
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
    dispatch("focus", null);
    dispatch("blur", null);
  }}
>
  Menu
</button>
