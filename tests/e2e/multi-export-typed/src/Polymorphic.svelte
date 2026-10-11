<script>
  /** @template {keyof HTMLElementTagNameMap} [Tag="div"] */

  /**
   * Specify the element to render.
   * @type {Tag}
   */
  export let tag = "div";
</script>

<svelte:element
  this={tag}
  {...$$restProps}
>
  <slot />
</svelte:element>
