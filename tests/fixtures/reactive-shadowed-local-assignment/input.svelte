<script>
  export let disabled = false;
  const items = [{ disabled: true }];

  function readItem(index) {
    let disabled = items[index].disabled;
    return disabled;
  }
</script>

<button on:click={() => readItem(0)}>read</button>
