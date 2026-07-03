<svelte:options customElement="my-widget" />

<script>
  let { value } = $props();

  function notify() {
    $host().dispatchEvent(new CustomEvent("notify", { detail: value }));
  }
</script>

<button onclick={notify}>{value}</button>
