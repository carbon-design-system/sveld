<script context="module">
  /** Counts things. */
  class Counter {
    /**
     * @param {number} start
     */
    constructor(start) {
      /** @type {number} */
      this.count = start;
    }

    /** @returns {Counter} */
    increment() {
      this.count += 1;
      return this;
    }
  }

  /** Same class, renamed. */
  export { Counter, Counter as Tally, Counter as "counter-class" };
</script>

<script>
  const counter = new Counter(0);
</script>

<div>{counter.count}</div>
