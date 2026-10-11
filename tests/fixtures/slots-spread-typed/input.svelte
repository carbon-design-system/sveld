<script>
  /** @slot {{ a: number; }} */
  /** @slot {{ a: number; }} text */
  /** @slot {{ style: string }} icon */

  const props = {
    a: 4,
  };

  export let iconStyle = "";

  // Reactive, so sveld can't read its shape; the `@slot` type covers it.
  $: iconProps = { style: iconStyle };
</script>

<slot {...props}>Default text</slot>
<slot
  name="text"
  {...props}
/>
<slot
  name="icon"
  {...iconProps}
/>
