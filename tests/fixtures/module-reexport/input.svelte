<script context="module" lang="ts">
  import { tokTypes } from "acorn";
  export { tokTypes };
</script>

<script lang="ts">
  /** Chart data to display */
  export let data = null;

  /** Chart title */
  export let title = 'Chart';
</script>

<div class="chart">
  <h2>{data} {title}</h2>
  <slot />
</div>
