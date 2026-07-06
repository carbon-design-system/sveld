<script>
  import { setContext } from "svelte";

  /**
   * "$" is a valid TypeScript identifier character but also a regex
   * metacharacter (end-of-string anchor). Detecting whether a context
   * property references this generic must not be thrown off by it.
   * @template {string} Value$Type
   */

  /**
   * @type {Value$Type}
   */
  const value = /** @type {any} */ (undefined);

  setContext("Demo", { value });
</script>

<div><slot /></div>
