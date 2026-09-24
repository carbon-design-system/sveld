<script>
  let kind = "a";

  export { kind as variant, open };

  let open = false;
  let count = 0;

  export { count };

  function toggle() {
    open = !open;
    kind = "b";
    count++;
  }
</script>

<button
  class={kind}
  on:click={toggle}
>
  {open} {count}
</button>
