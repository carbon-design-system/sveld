<script>
  /**
   * @deprecated this prop will be removed in the next major release
   * Set to `true` to use the small variant
   */
  export let small = false;

  /**
   * Specify the size of the search input
   * @type {"sm" | "lg" | "xl"}
   */
  export let size = "xl";
</script>

<div
  class:bx--skeleton={true}
  class:bx--search--sm={size === "sm" || small}
  class:bx--search--lg={size === "lg"}
  class:bx--search--xl={size === "xl"}
  {...$$restProps}
  on:click
  on:mouseover
  on:mouseenter
  on:mouseleave
>
  <span class:bx--label={true} />
  <div class:bx--search-input={true} />
</div>
