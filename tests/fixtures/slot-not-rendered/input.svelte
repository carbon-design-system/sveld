<script>
  /**
   * The first word of an inline description is read as the slot name.
   * @slot {{}} Page content rendered after the header.
   */
  export let title = "";
</script>

<h1>{title}</h1>
<slot />
