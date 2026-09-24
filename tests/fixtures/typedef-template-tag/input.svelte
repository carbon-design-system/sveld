<script>
  /**
   * A boxed value.
   * @template T
   * @typedef {{ value: T }} Box
   */

  /**
   * @template {string} K
   * @template [V=unknown]
   * @typedef {object} Entry
   * @property {K} key The key.
   * @property {V} value The value.
   */

  /**
   * @template T
   * @callback Mapper
   * @param {T} item
   * @returns {string}
   */

  /**
   * @typedef {{ id: string }} Row
   * @template {Row} [R=Row]
   */

  /** @type {Box<number>} */
  export let box = { value: 1 };

  /** @type {Entry<"a", number>} */
  export let entry = { key: "a", value: 1 };

  /** @type {Mapper<R>} */
  export let mapper = (item) => item.id;
</script>
