<script>
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();
  function onClick() {
    dispatch("click", { x: 1 });
  }
</script>

<button
  on:click={onClick}
  on:click
>
  click me
</button>
