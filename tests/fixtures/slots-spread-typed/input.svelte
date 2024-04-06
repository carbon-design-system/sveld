<script>
  /** @slot {{ a: number; }} */
  /** @slot {{ a: number; }} text */

  const props = {
    a: 4,
  };
</script>

<slot {...props}>Default text</slot>
<slot name="text" {...props} />
