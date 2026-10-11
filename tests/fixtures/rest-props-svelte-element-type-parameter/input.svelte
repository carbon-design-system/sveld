<script>
  /** @template {keyof HTMLElementTagNameMap} [Tag="div"] */

  /**
   * Specify the element to render.
   * @type {Tag}
   */
  export let tag = "div";

  export let ref = null;
</script>

<svelte:element
  this={tag}
  bind:this={ref}
  {...$$restProps}
>
  <slot />
</svelte:element>
