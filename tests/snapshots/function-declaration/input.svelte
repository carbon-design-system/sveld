<script>
  export let fnA = () => {};

  export const fnB = () => {};

  export function add(a, b) {
    return a + b;
  }

  /** 
   * Multiplies two numbers
   * @type {(a: number, b: number) => number}
   */
  export function multiply(a, b) {
    return a * b;
  }
</script>

<h1 on:click={fnA}>Heading</h1>