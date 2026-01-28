<script>
  /** @slot {{ item: string; index: number; isFirst: boolean; isLast: boolean; }} */
  /** @type {string[]} */
  export let items = [];
</script>

{#each items as item, index}
  <slot {item} {index} isFirst={index === 0} isLast={index === items.length - 1}>
    <span>{item}</span>
  </slot>
{/each}
