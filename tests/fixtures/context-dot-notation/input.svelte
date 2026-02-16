<script>
  import { setContext } from "svelte";

  /**
   * Open the modal
   * @type {() => void}
   */
  const open = () => {};

  /**
   * Close the modal
   * @type {() => void}
   */
  const close = () => {};

  setContext("Carbon.Modal", { open, close });
</script>
