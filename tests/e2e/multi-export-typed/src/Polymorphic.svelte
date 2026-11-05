<script>
  /** @template {keyof HTMLElementTagNameMap} [Tag="div"] */

  /**
   * Specify the element to render.
   * @type {Tag}
   */
  export let tag = "div";

  /**
   * Span the container. Named as an attribute of some elements (`img`),
   * which it replaces there.
   */
  export let width = false;
</script>

<svelte:element
  this={tag}
  data-width={width}
  {...$$restProps}
>
  <slot />
</svelte:element>
