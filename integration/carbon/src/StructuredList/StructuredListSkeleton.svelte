<script>
  /** Specify the number of rows */
  export let rows = 5;

  /** Set to `true` to use the bordered variant */
  export let border = false;
</script>

<div
  class:bx--skeleton={true}
  class:bx--structured-list={true}
  class:bx--structured-list--border={border}
  {...$$restProps}
  on:click
  on:mouseover
  on:mouseenter
  on:mouseleave
>
  <div class:bx--structured-list-thead={true}>
    <div class:bx--structured-list-row={true} class:bx--structured-list-row--header-row={true}>
      <div class:bx--structured-list-th={true}><span /></div>
      <div class:bx--structured-list-th={true}><span /></div>
      <div class:bx--structured-list-th={true}><span /></div>
    </div>
  </div>
  <div class:bx--structured-list-tbody={true}>
    {#each Array.from({ length: rows }, (_, i) => i) as row, i (row)}
      <div class:bx--structured-list-row={true}>
        <div class:bx--structured-list-td={true} />
        <div class:bx--structured-list-td={true} />
        <div class:bx--structured-list-td={true} />
      </div>
    {/each}
  </div>
</div>
