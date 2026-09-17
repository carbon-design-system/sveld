<script lang="ts">
  import type { Size } from "./typed-thing-types";

  export let size: Size = "sm";
</script>

<div class="size-{size}">
  <slot />
</div>
