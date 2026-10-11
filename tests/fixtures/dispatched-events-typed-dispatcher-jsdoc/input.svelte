<script>
  import { createEventDispatcher } from "svelte";

  /** @type {import('svelte').EventDispatcher<{ save: { id: string }; cancel: null; "change:value": string; "a;b": number }>} */
  const dispatch = createEventDispatcher();

  function save(id) {
    dispatch("save", { id });
  }
</script>

<button onclick={() => save("1")}>Save</button>
