<script>
  export let disabled = false;
  const items = [true, false];

  for (const item of items) {
    ((disabled) => {
      let current = disabled;
      current = !current;
    })(item);
  }
</script>

<div>{items.length}</div>
