<script>
  export let items = [];
  export let config = {};
  /** @type {string[]} */
  export let names = [];
  /** @type {{ enabled: boolean }} */
  export let settings = {};
  export let nested = { items: [], meta: {} };
</script>

<div>{items.length}</div>
