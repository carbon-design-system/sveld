<script
  lang="ts"
  generics="Item"
>
  import { setContext } from "svelte";

  const controller: AbortController = new AbortController();
  setContext("abort", controller);

  const selected: Item[] = [];
  setContext("selected", selected);

  const settings: { dense: boolean; label?: string } = { dense: false };
  setContext("settings", settings);

  const api = { reset: () => {}, version: "1" };
  setContext("api", api);

  let store = createStore();
  setContext("store", store);
</script>

<slot />
