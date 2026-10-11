<script>
  import { setContext } from "svelte";
  import { readonly, writable } from "svelte/store";

  const level = writable(1);

  setContext("count", writable(0));
  setContext("level", readonly(level));
  setContext("parent", undefined);
  setContext("group", null);
</script>

<slot />
