<script>
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  const state = { a: 1 };
  const key = "k";

  function notify() {
    dispatch("spread", { ...state });
    dispatch("empty", {});
    dispatch("computed", { [key]: 1 });
    dispatch("mixed", { id: 1, ...state });
  }
</script>

<button onclick={notify}>Notify</button>
