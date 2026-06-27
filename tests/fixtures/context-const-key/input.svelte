<script>
  import { setContext } from "svelte";

  const CONTEXT_KEY = "simple-modal";

  /**
   * Close the modal
   * @type {() => void}
   */
  const close = () => {};

  /**
   * Open the modal with content
   * @type {(component: any, props?: any) => void}
   */
  const open = (component, props) => {};

  setContext(CONTEXT_KEY, { open, close });
</script>

<div class="modal"><slot /></div>
