<script context="module">
  function helper(value) {
    return value;
  }

  export { helper as format };
</script>

<script>
  export { size };

  let size = 1;

  const obj = { x: 1, y: "a" };
  let { x, y } = obj;

  export { x, y as why };

  export let { a, b } = obj;

  function reset() {}

  export { reset };

  class Foo {}

  export { Foo };
</script>

<button on:click={reset}>{size} {x} {y} {a} {b}</button>
