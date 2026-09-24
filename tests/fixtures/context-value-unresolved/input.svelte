<script>
  import { setContext } from "svelte";
  import { writable } from "svelte/store";
  import { CACHE_KEY } from "./keys.js";

  setContext("store", writable(0));
  setContext(CACHE_KEY, new Map());
</script>

<div><slot /></div>
