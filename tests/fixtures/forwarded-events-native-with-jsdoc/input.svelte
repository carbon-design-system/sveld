<script>
  /**
   * @event click - Fired when the button is clicked
   * @event focus - Fired when the button receives focus
   * @event blur - Fired when the button loses focus
   */
</script>

<button on:click on:focus on:blur>
  <slot />
</button>
