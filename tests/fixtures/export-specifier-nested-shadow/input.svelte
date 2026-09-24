<script context="module">
  function make() {
    const value = "inner";
    return value;
  }
  export function helper() {
    let size = "from-module-helper";
    return size;
  }
  const value = 1;

  export { value };
</script>

<script>
  function read() {
    const label = "nested";
    return label;
  }
  let size = 1;
  let label = true;

  export { label, size };
</script>

<div>{size} {label} {make()} {read()}</div>
