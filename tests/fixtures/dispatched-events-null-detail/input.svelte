<script>
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  function clear() {
    dispatch("clear", null);
  }
</script>

<button onclick={clear}>Clear</button>
