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
  export let items = new Map();
  export let tags = new Set();
  export let weakData = new WeakMap();
  export let weakRefs = new WeakSet();
  // biome-ignore lint/style/useArrayLiterals: testing constructor expression
  export let itemsArray = new Array();
  // biome-ignore lint/complexity/useRegexLiterals: testing constructor expression
  export let pattern = new RegExp("test");
  export let customError = new Error("message");
</script>

<div>Cache: {cache.size}</div>
