<script>
  /**
   * Toolbar: icon-only mode uses low-contrast - same as hover-state.
   * @example
   * ```svelte
   * <Toolbar><Icon /></Toolbar>
   * ```
   * @slot {{ compact: boolean }} actions
   */
  /**
   * Status text for live regions; prefer `aria-current="page"` on the active link.
   * @deprecated Use the `live` region pattern instead.
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
