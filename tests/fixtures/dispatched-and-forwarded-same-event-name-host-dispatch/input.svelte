<svelte:options customElement="my-el" />

<script>
  function onClick() {
    $host().dispatchEvent(new CustomEvent("click", { detail: 1 }));
  }
</script>

<button
  on:click={onClick}
  on:click
>
  click
</button>
