<script>
  /**
   * Set the `href` to use an anchor link
   * @type {string}
   */
  export let href = undefined;

  /**
   * Specify the size of button skeleton
   * @type {"default" | "field" | "small"}
   */
  export let size = "default";

  /**
   * @deprecated this prop will be removed in the next major release
   * Use size="small" instead
   */
  export let small = false;
</script>

{#if href}
  <a
    {href}
    rel={$$restProps.target === "_blank" ? "noopener noreferrer" : undefined}
    role="button"
    class:bx--skeleton={true}
    class:bx--btn={true}
    class:bx--btn--field={size === "field"}
    class:bx--btn--sm={size === "small" || small}
    {...$$restProps}
    on:click
    on:mouseover
    on:mouseenter
    on:mouseleave
  >
    {""}
  </a>
{:else}
  <div
    class:bx--skeleton={true}
    class:bx--btn={true}
    class:bx--btn--field={size === "field"}
    class:bx--btn--sm={size === "small" || small}
    {...$$restProps}
    on:click
    on:mouseover
    on:mouseenter
    on:mouseleave
  />
{/if}
