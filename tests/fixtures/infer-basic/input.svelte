<script>
  export let ref = null;
  export let propBool = true;
  export let propString = "";
  export let name;
  export let id = "" + Math.random().toString(36);
  export const propConst = { 1: true };
  export function fn() {
    localBool = !localBool;
  }

  let localBool = false;
</script>

<div
  class:ref
  class:propBool
  class:propString
  class:id
  on:click={() => {
    propBool = !propBool;
  }}
>
  <slot>{name}</slot>
</div>
