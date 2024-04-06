<script>
  /** @restProps {h1 | span} */
  export let edit = false;
  export let heading = false;

  import Button from "../";
</script>

{#if edit}
  <Button {...$$restProps} />
{:else if heading}
  <!-- svelte-ignore a11y-missing-content -->
  <h1 {...$$restProps} />
{:else}<span {...$$restProps} />{/if}
