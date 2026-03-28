<script>
  export let disabled = false;

  function enable() {
    disabled = true;
  }
</script>

<button on:click={enable}>enable</button>
