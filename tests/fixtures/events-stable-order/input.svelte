<script>
  import { createEventDispatcher, onDestroy } from "svelte";

  const dispatch = createEventDispatcher();

  onDestroy(() => {
    dispatch("zeta");
    dispatch("alpha");
  });
</script>

<button on:click />
<input on:blur>
