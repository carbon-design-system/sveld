<script>
  /** @type {string | undefined} */
  export let href = undefined;

  /** @type {null | HTMLAnchorElement | HTMLButtonElement} */
  export let ref = null;

  /** @type {null | HTMLElement} */
  export let buttonRef = null;

  export let inferredRef = null;
</script>

<svelte:element
  this={href ? "a" : "button"}
  bind:this={ref}
  {href}
/>
<button bind:this={buttonRef} />
<div bind:this={inferredRef} />
