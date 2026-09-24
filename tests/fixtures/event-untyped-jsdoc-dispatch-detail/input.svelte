<script>
  /**
   * @event close Fired on close.
   * @event open Fired on open.
   * @event {null} reset Fired on reset.
   * @event toggle Fired on toggle.
   */

  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  $: dispatch("close", { reason: "user" });
  $: dispatch("open");
  $: dispatch("reset", { count: 1 });
</script>
