<script>
  import { setContext } from "svelte";

  /**
   * Refresh the data
   * @type {() => void}
   */
  const refresh = () => {};

  /**
   * Reset the state
   * @type {() => void}
   */
  const reset = () => {};

  setContext("App.data-table_v2", { refresh, reset });
</script>
