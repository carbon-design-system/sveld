<script>
  /**
   * @template Item
   * @template {keyof HTMLElementTagNameMap} [Tag="ul"]
   */

  /**
   * Specify the element to render.
   * @type {Tag}
   */
  export let tag = "ul";

  /** @type {Item[]} */
  export let items = [];
</script>

<svelte:element
  this={tag}
  {...$$restProps}
>
  {#each items as item}
    <slot {item} />
  {/each}
</svelte:element>
