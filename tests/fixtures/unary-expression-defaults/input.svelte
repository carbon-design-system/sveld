<script>
  /** Negative number constant */
  export let offset = -1;

  /** Negative decimal */
  export let threshold = -0.5;

  /** @type {boolean} */
  export let inverted = !false;

  /** Bitwise NOT */
  export let bitmask = ~0;

  /** Double negation */
  export let absolute = -(-5);
</script>

<div data-offset={offset}>{inverted} {bitmask} {absolute}</div>
