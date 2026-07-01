<script>
  /**
   * Formats a value. Its example is valid and should compile cleanly.
   * @param {string} value
   * @returns {string}
   * @example
   * ```js
   * formatValue("ok");
   * ```
   */
  export function formatValue(value) {
    return value;
  }

  /**
   * Renamed from `oldFormatName`; the example below was never updated and
   * still calls the old, now-nonexistent name.
   * @param {string} value
   * @returns {string}
   * @example
   * ```js
   * oldFormatName("ok");
   * ```
   */
  export function newFormatName(value) {
    return value;
  }

  /**
   * Its example calls it with more arguments than it declares.
   * @param {string} value
   * @returns {string}
   * @example
   * ```js
   * tooManyArgs("a", "b", "c");
   * ```
   */
  export function tooManyArgs(value) {
    return value;
  }

  /**
   * Svelte example, not TS/JS. sveld skips it.
   * @example
   * ```svelte
   * <Widget prop={doesNotExist} />
   * ```
   */
  export let widgetSlot = "unused";
</script>
