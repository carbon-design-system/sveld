<script>
  export let type = "button2";
  export let primary = false;
</script>

<button {...$$restProps} {type} class:primary on:click>
  <slot>Click me</slot>
</button>
