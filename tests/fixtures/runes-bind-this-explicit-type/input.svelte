<script>
  /**
   * @type {{
   *   href?: string;
   *   ref?: null | HTMLAnchorElement | HTMLButtonElement;
   *   buttonRef?: null | HTMLElement;
   *   inferredRef?: null | HTMLDivElement;
   * }}
   */
  let { href, ref = $bindable(null), buttonRef = $bindable(null), inferredRef = $bindable(null) } = $props();
</script>

<svelte:element
  this={href ? "a" : "button"}
  bind:this={ref}
  {href}
/>
<button bind:this={buttonRef} />
<div bind:this={inferredRef} />
