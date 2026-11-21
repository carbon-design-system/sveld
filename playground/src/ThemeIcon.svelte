<script lang="ts">
  import Asleep from "carbon-icons-svelte/lib/Asleep.svelte";
  import Light from "carbon-icons-svelte/lib/Light.svelte";
</script>

<!-- Both icons, so the prerendered page matches any theme; CSS shows one. -->
<Asleep {...$$restProps} class="theme-icon-white" />
<Light {...$$restProps} class="theme-icon-g100" />

<style>
  :global([theme="g100"] .theme-icon-white),
  :global(:root:not([theme="g100"]) .theme-icon-g100) {
    display: none;
  }
</style>
