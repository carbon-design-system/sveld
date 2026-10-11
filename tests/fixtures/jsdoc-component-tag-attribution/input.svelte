<script>
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  /**
   * @typedef {string} Secret
   * @internal
   */

  /**
   * @typedef {"sm" | "lg"} OldSize
   * @deprecated Use `Size`.
   * @slot {{ size: OldSize }} sized
   */

  /**
   * @deprecated Use `toggle`.
   * @event {null} open
   */

  /**
   * Fires when the panel closes.
   * @event {null} close
   * @slot {{}} footer
   * @deprecated Put this above the slot it deprecates.
   */
  export let size = "sm";

  /**
   * Label for the panel.
   * @generics {T extends string = string} T
   */
  export let label = "";
</script>

<slot
  name="sized"
  {size}
/>
<slot name="footer" />
<button on:click={() => dispatch("open")}>open</button>
<button on:click={() => dispatch("close")}>close</button>
<p>{label}</p>
