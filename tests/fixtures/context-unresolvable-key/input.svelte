<script>
  import { setContext } from "svelte";

  export let dynamicKey = "modal";

  /**
   * Close the modal
   * @type {() => void}
   */
  const close = () => {};

  setContext(dynamicKey, { close });
</script>

<div class="modal"><slot /></div>
