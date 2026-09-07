<script lang="ts">
  import type { Size } from "./types";

  export let size: Size = "sm";
</script>

<div class="size-{size}"><slot /></div>
