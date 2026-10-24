<script>
  /**
   * `@extends` with type arguments: the import takes the bare interface name
   * and the props alias keeps the arguments, so `x` is typed by this
   * component's own `T` rather than the base's default.
   * @template [T=any]
   * @extends {"./Base.svelte"} BaseProps<T>
   */

  /**
   * Specify the curve.
   * @type {"linear" | "monotone"}
   */
  export let curve = "linear";

  import Base from "./Base.svelte";
</script>

<Base
  {...$$restProps}
  data-curve={curve}
/>
