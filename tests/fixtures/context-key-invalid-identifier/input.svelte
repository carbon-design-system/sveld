<script>
  import { setContext } from "svelte";

  /** @type {number} */
  let count = 0;

  setContext("@scope/ctx", { count });
  setContext("123", { count });
  setContext("my key!", { count });
</script>

<div></div>
