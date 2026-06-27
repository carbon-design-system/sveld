<script>
  import { setContext } from "svelte";

  const KEY = Symbol("tabs");

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

  setContext(KEY, { activeTab, registerTab });
</script>

<div class="tabs"><slot /></div>
