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
</script>

<div id={id} data-timestamp={timestamp}>{uppercased}</div>
