<script>
  import { setContext } from "svelte";

  /** @type {{ open: () => void }} Opens the modal */
  const modal = { open: () => {} };
  setContext("modal", modal);

  /**
   * @type {{ toggle: () => void }}
   * Toggles the menu
   * when clicked.
   */
  const menu = { toggle: () => {} };
  setContext("menu", menu);

  /** @type {() => void} Closes the drawer */
  const close = () => {};
  setContext("drawer", { close });
</script>

<slot />
