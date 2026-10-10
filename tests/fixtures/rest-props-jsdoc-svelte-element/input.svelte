<script>
  /**
   * @restProps {svelte:element}
   */

  /** @type {keyof HTMLElementTagNameMap} */
  export let tag = "div";

  $: props = { ...$$restProps, class: ["stack", $$restProps.class].filter(Boolean).join(" ") };
</script>

<svelte:element
  this={tag}
  {...props}
>
  <slot />
</svelte:element>
