<script lang="ts">
  import type { Size } from "./types";

  let { size }: { size: Size } = $props();
</script>

<div class="size-{size}"></div>
