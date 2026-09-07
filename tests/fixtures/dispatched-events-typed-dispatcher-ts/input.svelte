<script lang="ts">
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher<{ save: { id: string }; cancel: null }>();

  function save(id: string) {
    dispatch("save", { id });
  }
</script>

<button onclick={() => save("1")}>Save</button>
