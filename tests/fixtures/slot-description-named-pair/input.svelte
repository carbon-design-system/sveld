<script>
  /**
   * Toolbar: icon-only mode uses low-contrast - same as hover-state.
   * @slot {{ compact: boolean }} actions
   */
  /**
   * Status text for live regions; prefer `aria-current="page"` on the active link, not `aria-selected`.
   * Pair with `aria-live="polite"` unless the update is urgent (then use `assertive`).
   * @slot {{ message: string }} status
   */
</script>

<slot
  name="actions"
  compact={false}
/>
<slot
  name="status"
  message=""
/>
