<script>
  /**
   * Fired when a value is saved.
   * @event {{ id: string }} save
   * @event close
   */
  let { onsave, onclose } = $props();
</script>

<button
  onclick={() => {
    onsave?.({ id: "1" });
    onclose?.();
  }}
>
  Save
</button>
