<script>
  /** Set to `true` to use the active variant */
  export let isActive = false;

  /**
   * Specify the icon to render
   * @type {typeof import("carbon-icons-svelte").CarbonIcon}
   */
  export let icon = undefined;

  /** Obtain a reference to the HTML button element */
  export let ref = null;
</script>

<button
  type="button"
  bind:this={ref}
  class:bx--header__action={true}
  class:bx--header__action--active={isActive}
  {...$$restProps}
  on:click
>
  <slot>
    <svelte:component this={icon} />
  </slot>
</button>
