<script>
  import { setContext } from "svelte";

  const KEY = Symbol("tabs");
  const ModalKey = Symbol();

  /**
   * The currently active tab index.
   * @type {number}
   */
  let activeTab = 0;

  /**
   * Register a tab and return its index.
   * @type {(label: string) => number}
   */
  const registerTab = (label) => 0;

  /**
   * Push a notification message.
   * @type {(message: string) => void}
   */
  const notify = (message) => {};

  setContext(KEY, { activeTab, registerTab });
  setContext(Symbol.for("notification"), { notify });
  setContext(ModalKey, { notify });
</script>

<div class="tabs"><slot /></div>
