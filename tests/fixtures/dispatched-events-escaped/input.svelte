<script>
  import { createEventDispatcher } from "svelte";
  import { createDialogLifecycle } from "./dialog-lifecycle.js";
  import { createOpenCloseDispatcher } from "./dispatch-open-close.js";

  export let open = false;

  const dispatch = createEventDispatcher();
  const notifyOpenChange = createOpenCloseDispatcher(dispatch);
  const lifecycle = createDialogLifecycle({ open, dispatch });

  $: notifyOpenChange(open);

  function close() {
    open = false;
    dispatch("close");
    lifecycle.destroy();
  }
</script>

<button on:click={close}>Close</button>
