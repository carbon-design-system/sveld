<script>
  export let fnA = () => {};

  export const fnB = () => {};

  export function add(a, b) {
    return a + b;
  }

  export function reset() {}

  export function format(value, locale = "en", ...rest) {
    return "";
  }

  export function pick({ id }) {
    return id;
  }

  /** @param {number} n */
  export function double(n) {
    return n * 2;
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
