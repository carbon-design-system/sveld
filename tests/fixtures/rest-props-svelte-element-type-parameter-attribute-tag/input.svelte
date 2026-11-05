<script>
  /** @template {keyof HTMLElementTagNameMap} [Tag="div"] */

  /**
   * Specify the element to render.
   * @type {Tag}
   */
  export let tag = "div";

  /**
   * Named as an attribute of some elements, which it replaces there.
   * @type {"full" | "auto"}
   */
  export let width = "auto";
</script>

<svelte:element
  this={tag}
  data-width={width}
  {...$$restProps}
>
  <slot />
</svelte:element>
