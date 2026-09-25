<svelte:options customElement="detail-host" />

<script>
  let count = $state(0);
  let label = "none";

  function change() {
    $host().dispatchEvent(new CustomEvent("change", { detail: { count, label } }));
  }

  function tick() {
    $host().dispatchEvent(new CustomEvent("tick", { detail: count }));
  }
</script>

<button onclick={change}>Change</button>
<button onclick={tick}>Tick</button>
