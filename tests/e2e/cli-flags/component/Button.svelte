<script>
  export let label = "Click";
  export let value;
  export let variant = "solid";
</script>

<button class="variant-{variant}" on:click>
  {label}: {value}
</button>
