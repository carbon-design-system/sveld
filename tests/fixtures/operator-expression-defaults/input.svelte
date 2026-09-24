<script>
  export let size = 1;
  export let label = "x";

  /** @type {string | undefined} */
  export let prefix = undefined;

  let factor = 3;

  /** Arithmetic */
  export let doubled = size * 2;

  /** Numeric addition */
  export let next = size + 1;

  /** String concatenation with a string-typed prop */
  export let suffixed = label + "-end";

  /** String concatenation with a number */
  export let withUnit = size + "px";

  /** `+` of two untyped values can't be told apart */
  export let unknownSum = prefix + factor;

  /** Bitwise */
  export let truncated = size | 0;

  /** Comparison */
  export let isLarge = size > factor;

  /** `in` */
  export let hasKey = "key" in {};

  /** Logical not */
  export let hidden = !size;

  /** typeof */
  export let kind = typeof size;

  /** Nullish fallback of the same type */
  export let count = size ?? 5;

  /** Mixed fallback */
  export let either = size || "none";

  /** Conditional */
  export let variant = size > 1 ? "large" : "small";

  /** Object literal whose member isn't a literal */
  export let point = { x: size, y: 0 };

  /** Array literal whose element isn't a literal */
  export let pair = [size, 1];

  $: area = size * factor;

  export { area };
</script>

<div>
  {doubled} {next} {suffixed} {withUnit} {unknownSum} {truncated} {isLarge} {hasKey} {hidden} {kind} {count} {either}
  {variant} {point} {pair} {area}
</div>
