<script>
  import { setContext } from "svelte";
  import { getRest } from "./rest.js";

  const base = { a: 1 };

  setContext("merged", { ...base, b: "x" });
  setContext("widened", { ...getRest(), c: true });
  setContext("merged", { z: 1 });
</script>

<slot />
