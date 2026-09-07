<script>
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  /** @type {string} */
  export let id;

  function save() {
    dispatch("save", { id });
  }

  function reorder() {
    dispatch("items", [1, 2]);
  }
</script>

<button onclick={save}>Save</button>
<button onclick={reorder}>Reorder</button>
