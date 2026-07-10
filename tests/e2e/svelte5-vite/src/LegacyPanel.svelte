<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let title: string;

  const dispatch = createEventDispatcher<{ close: { reason: string } }>();

  function handleClose() {
    dispatch("close", { reason: "user" });
  }
</script>

<div>
  <h2>{title}</h2>
  <button on:click>Forwarded</button>
  <button on:click={handleClose}>Close</button>
</div>
