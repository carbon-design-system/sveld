<script>
  import { createEventDispatcher } from "svelte";

  let { value } = $props();

  const dispatch = createEventDispatcher();
</script>

<button onclick={() => dispatch("change", value)}>click</button>
