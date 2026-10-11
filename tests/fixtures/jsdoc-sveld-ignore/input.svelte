<script>
  import { compute } from "./compute.js";

  /**
   * Suppresses only the named diagnostic.
   * @sveld-ignore sveld/prop-unknown-type
   */
  export let ignored = compute();

  /**
   * A bare tag suppresses every diagnostic for the prop.
   * @sveld-ignore
   */
  export let ignoredAll = compute();

  /**
   * A different code leaves this prop's diagnostic in place.
   * @sveld-ignore sveld/context-any-type
   */
  export let otherCode = compute();

  export let reported = compute();
</script>
