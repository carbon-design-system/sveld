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

  function clear() {
    dispatch("clear", null);
  }

  function complete() {
    dispatch("status", "done");
  }
</script>

<button onclick={save}>Save</button>
<button onclick={reorder}>Reorder</button>
<button onclick={clear}>Clear</button>
<button onclick={complete}>Complete</button>
