<script>
  import { setContext } from "svelte";

  /**
   * Select an item
   * @type {(id: string) => void}
   */
  const select = (id) => {};

  /**
   * Clear the selection
   * @type {() => void}
   */
  const clear = () => {};

  setContext("user_settings", { select, clear });
</script>
