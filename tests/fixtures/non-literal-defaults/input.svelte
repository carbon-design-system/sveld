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
  export let maxValue = Infinity;

  /**
   * Optional handler with undefined
   */
  export let handler = undefined;
</script>

<div class="component" data-position={position} data-theme={theme}>
  Content
</div>
