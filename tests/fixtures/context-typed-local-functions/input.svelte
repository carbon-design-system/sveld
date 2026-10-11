<script lang="ts">
  import { setContext } from "svelte";

  const select = (id: string) => {
    console.log(id);
  };

  function count(items: string[]) {
    return 0;
  }

  setContext("list", { select, count });
</script>
