<script>
  /**
   * @extends {"./IconSkeleton.svelte"} IconSkeletonProps
   * @restProps {svg}
   */

  /**
   * Specify the icon from `carbon-icons-svelte` to render
   * @type {typeof import("carbon-icons-svelte").CarbonIcon}
   */
  export let render = undefined;

  /** Set to `true` to display the skeleton state */
  export let skeleton = false;

  import IconSkeleton from "./IconSkeleton.svelte";
</script>

{#if skeleton}
  <IconSkeleton {...$$restProps} on:click on:mouseover on:mouseenter on:mouseleave />
{:else}
  <svelte:component this={render} {...$$restProps} on:click on:mouseover on:mouseenter on:mouseleave />
{/if}
