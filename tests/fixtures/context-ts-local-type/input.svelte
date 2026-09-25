<script lang="ts">
  import { setContext } from "svelte";
  import { type Writable, writable } from "svelte/store";

  interface ModalAPI {
    open: () => void;
    close: () => void;
  }

  type Density = "compact" | "comfortable";

  const modalAPI: ModalAPI = {
    open() {},
    close() {},
  };
  setContext("modal", modalAPI);

  let density: Density = "compact";
  const zoom: Writable<number> = writable(1);
  setContext("layout", { density, zoom });
</script>

<slot />
