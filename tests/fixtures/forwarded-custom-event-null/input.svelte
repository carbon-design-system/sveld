<script>
  import CustomComponent from './CustomComponent.svelte';

  /**
   * @event {null} clear - Clear button clicked with no data
   * @event {string} search - Search query changed
   */
</script>

<!-- Forwarding custom events from a component -->
<CustomComponent on:clear on:search />
