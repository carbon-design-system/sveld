<script>
  /**
   * `@type` without a preceding `@event` is ignored for events and must not become a passthrough tag.
   * @type {string}
   * @slot {{ flag: boolean }} row
   */
</script>

<slot
  name="row"
  flag={false}
/>
