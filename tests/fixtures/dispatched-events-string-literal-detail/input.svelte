<script>
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  function complete() {
    dispatch("status", "done");
  }
</script>

<button onclick={complete}>complete</button>
