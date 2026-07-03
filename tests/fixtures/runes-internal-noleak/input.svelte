<script>
  let { value, onchange } = $props();

  let doubled = $derived(value * 2);
  let tripled = $derived.by(() => value * 3);

  $effect(() => {
    onchange?.(doubled);
  });

  $effect.pre(() => {
    console.log("before update", doubled);
  });

  $inspect(doubled, tripled).with((type, ...values) => {
    console.log(type, values);
  });
</script>

<p>{doubled} {tripled}</p>
