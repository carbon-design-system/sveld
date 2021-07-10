<script>
  export let type = "button";
  export let primary = false;
  export function print() {
    console.log(0);
  }
</script>

<button {...$$restProps} {type} class:primary on:click>
  <slot>Click me</slot>
</button>
