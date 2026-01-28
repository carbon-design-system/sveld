<script>
  /** @type {Map<string, number>} */
  export let cache = new Map();
  /** @type {Set<string>} */
  export let selected = new Set();
  export let createdAt = new Date();
  /** @type {WeakMap<object, any>} */
  export let metadata = new WeakMap();
  /** @type {number[]} */
  export let buffer = new Array(10);
</script>

<div>Cache: {cache.size}</div>
