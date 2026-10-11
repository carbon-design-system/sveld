<script>
  import { setContext } from "svelte";

  /**
   * Open the modal
   * @type {() => void}
   */
  const open = () => {};

  /** @type {number} */
  let count = 0;

  const CONTEXT_KEY = "simple-modal";
  const BASE_KEY = "tabs";
  const ALIAS_KEY = BASE_KEY;

  setContext("Carbon:Modal", { open });
  setContext("My Context", { open });
  setContext("App.data-table_v2", { open });
  setContext("@scope/ctx", { count });
  setContext("123", { count });
  setContext("my key!", { count });
  setContext(CONTEXT_KEY, { open });
  setContext(ALIAS_KEY, { count });
</script>

<div></div>
