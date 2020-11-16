<script>
  export let ref;
  export let ref2;
  export let propBool = false;
</script>

{#if propBool}
  <button bind:this={ref}><slot /></button>
{:else}
  <h1 bind:this={ref}>
    <slot />
  </h1>
{/if}

<div bind:this={ref2} />
