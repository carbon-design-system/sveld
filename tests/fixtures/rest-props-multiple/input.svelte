<script>
  /** @restProps {ul | ol} */
  /** @type { "ordered" | "unordered" } */
  export let type = "ordered";
</script>


{#if type==='ordered'}
  <ol {...$$restProps} {type} />
{:else if type === "unordered"}
  <ul {...$$restProps} {type} />
{/if}
