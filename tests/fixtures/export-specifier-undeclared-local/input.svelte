<script context="module">
  const shared = "s";
</script>

<script>
  export let count = 1;

  $: label = "Count: " + count;

  export { label, shared };
</script>

<p>{label}</p>
