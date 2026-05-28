<script>
  /**
   * @event sort
   * @type {{ key: null; direction: "none" } | { key: string; direction: "ascending" | "descending" }}
   * @property {string | null} key - Proposed sort column, or `null` when direction is `none`.
   * @property {"ascending" | "descending" | "none"} direction - Proposed sort direction.
   * Dispatched when a sortable column header would change the active sort.
   */

  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  function handleSort() {
    dispatch("sort", { key: null, direction: "none" });
  }
</script>

<button on:click={handleSort}>Sort</button>
