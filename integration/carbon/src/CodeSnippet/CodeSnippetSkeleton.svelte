<script>
  /**
   * Set the type of code snippet
   * @type {"single" | "multi"}
   */
  export let type = "single";
</script>

<div
  class:bx--skeleton={true}
  class:bx--snippet={true}
  class:bx--snippet--single={type === "single"}
  class:bx--snippet--multi={type === "multi"}
  {...$$restProps}
  on:click
  on:mouseover
  on:mouseenter
  on:mouseleave
>
  <div class:bx--snippet-container={true}>
    {#if type === "single"}
      <span />
    {:else if type === "multi"}<span /> <span /> <span />{/if}
  </div>
</div>
