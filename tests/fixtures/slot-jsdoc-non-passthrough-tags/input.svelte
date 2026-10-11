<script>
  /**
   * `@enum` shares blocks with typedefs/slots in some codebases; it must not attach to the slot.
   * @enum {number}
   * @slot {{ id: string }} item
   */

  /**
   * `@type` without a preceding `@event` is ignored for events and must not become a passthrough tag.
   * @type {string}
   * @slot {{ flag: boolean }} row
   */

  /**
   * @template {string} T
   * Body slot uses a generic from `@template`; that tag must not appear on the slot in output.
   * @slot {{ n: number }} body
   */
</script>

<slot
  name="item"
  id=""
/>
<slot
  name="row"
  flag={false}
/>
<slot
  name="body"
  n={0}
/>
