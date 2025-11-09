<script context="module" lang="ts">
  import { Component as Original, Helper } from 'library';
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
