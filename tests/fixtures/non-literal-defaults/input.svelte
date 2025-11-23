<script>
  /**
   * @typedef {"top-left" | "top-right" | "bottom-left" | "bottom-right"} Position
   */

  /** @type {Position} */
  const TOP_LEFT = "top-left";
  const POSITION_DEFAULT = "bottom-right";

  /**
   * Position of the element
   * @type {Position}
   */
  export let position = TOP_LEFT;

  /**
   * Theme mode
   */
  export let theme = POSITION_DEFAULT;

  /**
   * Numeric constant with Infinity
   */
  export let maxValue = Number.POSITIVE_INFINITY;

  /**
   * Negative infinity constant
   */
  export let minValue = Number.NEGATIVE_INFINITY;

  /**
   * Maximum safe integer
   */
  export let maxSafeInt = Number.MAX_SAFE_INTEGER;

  /**
   * Minimum safe integer
   */
  export let minSafeInt = Number.MIN_SAFE_INTEGER;

  /**
   * Maximum numeric value
   */
  export let maxNumber = Number.MAX_VALUE;

  /**
   * Minimum numeric value
   */
  export let minNumber = Number.MIN_VALUE;

  /**
   * Math constant PI
   */
  export let pi = Math.PI;

  /**
   * Math constant E
   */
  export let e = Math.E;

  /**
   * Optional handler with undefined
   */
  export let handler = undefined;

  /**
   * Append to element
   * @type {HTMLElement}
   */
  export let appendTo = document.body;
</script>

<div class="component" data-position={position} data-theme={theme}>
  Content {maxValue} {minValue} {maxSafeInt} {minSafeInt} {maxNumber} {minNumber} {pi} {e} {handler} {appendTo}
</div>
