<script>
  const ACTUAL_VALUE = 42;
  const ALIAS = ACTUAL_VALUE;

  /** Two levels deep: ALIAS -> ACTUAL_VALUE -> 42. */
  export let chained = ALIAS;

  const A = "hello";
  const B = A;
  const C = B;
  const D = C;
  const E = D;

  /** Five levels deep: E -> D -> C -> B -> A -> "hello". Resolves within the depth limit. */
  export let deep5 = E;

  const V = true;
  const W = V;
  const X = W;
  const Y = X;
  const Z = Y;
  const BEYOND = Z;

  /** Six levels deep: BEYOND -> Z -> Y -> X -> W -> V -> true. Exceeds the depth limit. */
  export let deep6 = BEYOND;
</script>

{chained}
{deep5}
{deep6}
