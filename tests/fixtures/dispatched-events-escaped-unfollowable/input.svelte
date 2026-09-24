<script>
  /**
   * Fired by `registry.track`.
   * @event {null} open
   */
  import { createEventDispatcher } from "svelte";
  import { registry } from "./registry.js";

  const dispatch = createEventDispatcher();

  function notify(dispatcher) {
    dispatcher("close");
  }

  registry.track(dispatch);
  notify(dispatch);
</script>
