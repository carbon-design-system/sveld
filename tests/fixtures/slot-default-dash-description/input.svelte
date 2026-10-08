<script>
  /**
   * @slot {{}} - Page content rendered after the header.
   * @slot {{ title: string }} heading - Custom heading.
   */
  export let title = "";
</script>

<slot
  name="heading"
  {title}
/>
<slot />
