<script lang="ts">
  import { setContext } from "svelte";

  const ctx: { theme: string } = { theme: "dark" };
  setContext("app", ctx);

  /** @type {{ label: string }} */
  const jsdocCtx = { label: "legacy" };
  setContext("legacy", jsdocCtx);
</script>

<slot />
