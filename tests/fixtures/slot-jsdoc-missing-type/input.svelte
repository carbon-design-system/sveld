<script>
  /**
   * @slot named
   */
  export let title = "";
</script>

<div>
  <slot name="named" />
  {title}
</div>
