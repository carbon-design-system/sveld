<script>
  function generateId() {
    return Math.random().toString(36).slice(2);
  }

  /** @type {string} */
  export let id = generateId();
  /** @type {number} */
  export let timestamp = Date.now();
  /** @type {{ version: number }} */
  export let config = JSON.parse('{"version": 1}');
  /** @type {string} */
  export let uppercased = "hello".toUpperCase();

  // Untyped: the type comes from the called function's `@returns`, even
  // when the function is declared after the prop.
  export let hoisted = uniqueId();
  export let hoistedExport = exportedId();
  // A function in a nested block isn't in scope at the top level.
  export let blockScoped = helper();

  /** @returns {string} */
  function uniqueId() {
    return "x";
  }

  /** @returns {string} */
  export function exportedId() {
    return "x";
  }

  {
    /** @returns {string} */
    function helper() {
      return "x";
    }
  }
</script>

<div
  {id}
  data-timestamp={timestamp}
>
  {uppercased}
</div>
