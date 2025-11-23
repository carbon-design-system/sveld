<script>
  import { createEventDispatcher } from "svelte";

  /**
   * @event {string} change - The input value when changed
   */

  const dispatch = createEventDispatcher();
</script>

<!-- Forwarding the native 'change' event from input -->
<input on:change />
