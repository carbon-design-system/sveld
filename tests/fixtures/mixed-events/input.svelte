<script>
  /**
   * @event {FocusEvent | number} custom-focus
   * @event {FocusEvent | CustomEvent<FocusEvent>} blur
   */
  import { createEventDispatcher } from "svelte";

  const dispatcher = createEventDispatcher();
</script>

<button
  on:focus={(e) => {
    dispatcher("custom-focus", e | 0);
  }}
  on:blur
  on:blur={(e) => {
    dispatcher("blur", e);
  }}
/>
