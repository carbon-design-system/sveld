<script>
  export let propBool = true;
  export let propString = "";

  /** @type {string} */
  export let name;

  export let id = "" + Math.random().toString(36);

  /** @type {{ [key: string]: boolean; }} */
  export const propConst = { 1: true };
  export function fn() {
    localBool = !localBool;
  }

  let localBool = false;
</script>

<div
  class:propBool
  class:propString
  class:id
  on:click={() => {
    propBool = !propBool;
  }}
>
  <slot>{name}</slot>
</div>
