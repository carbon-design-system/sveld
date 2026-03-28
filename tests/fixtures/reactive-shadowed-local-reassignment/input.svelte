<script>
  export let disabled = false;

  function toggle() {
    let disabled = false;
    disabled = true;
  }
</script>

<button on:click={toggle}>toggle</button>
