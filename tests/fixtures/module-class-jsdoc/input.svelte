<script context="module">
  /**
   * An observable list.
   * @template T
   */
  export class List {
    /** @type {T[]} */
    items = [];

    /** Max length; untyped. */
    static limit = 10;

    untyped;

    /**
     * @param {T[]} initial - First items
     * @param {string} [label]
     */
    constructor(initial, label) {
      this.items = initial;
      /** The list's label. */
      this.label = label;
    }

    /**
     * Adds an item.
     * @param {T} item
     * @returns {number} The new length
     */
    push(item) {
      return this.items.push(item);
    }

    /**
     * @template U
     * @param {(item: T) => U} fn
     * @returns {List<U>}
     */
    map(fn) {
      return new List(this.items.map(fn));
    }

    clear() {
      this.items = [];
    }
  }
</script>

<div />
