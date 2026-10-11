<script>
  /**
   * @event {KeyboardEvent | MouseEvent} clear - Fired when clear button is clicked
   * @event {null} dismiss - Dismiss button clicked with no data
   * @event {string} search - Search query changed
   */
  import ListBoxSelection from "./ListBoxSelection.svelte";
</script>

<ListBoxSelection
  on:clear
  on:click
  on:dismiss
  on:search
/>
