<script>
  import { setContext } from "svelte";

  /**
   * Push a notification message.
   * @type {(message: string) => void}
   */
  const notify = (message) => {};

  setContext(Symbol.for("notification"), { notify });
</script>

<div class="notifications"><slot /></div>
