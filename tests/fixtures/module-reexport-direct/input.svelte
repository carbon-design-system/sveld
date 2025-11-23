<script context="module" lang="ts">
  export { Component, Helper, utils } from "external-lib";
</script>

<script>
  /** Configuration settings */
  export let config = { enabled: true };

  /** Optional callback function */
  export let onReady;
</script>

<div>
  <slot name="header" />
  <slot />
</div>
