<script context="module" lang="ts">
  import { Helper, Component as Original } from "library";
  export { Original as Renamed, Helper };
</script>

<script>
  /** Controls visibility */
  export let visible = true;

  /** Configuration object */
  export let config = {};
</script>

<div class:visible>
  <slot />
</div>
