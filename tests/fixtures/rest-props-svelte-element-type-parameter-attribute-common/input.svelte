<script>
  /** @template {keyof HTMLElementTagNameMap} [Tag="div"] */

  /**
   * Specify the element to render.
   * @type {Tag}
   */
  export let tag = "div";

  /** @type {{{ text: string }}} */
  export let title = { text: "" };
</script>

<svelte:element
  this={tag}
  data-title={title}
  {...$$restProps}
>
  <slot />
</svelte:element>
