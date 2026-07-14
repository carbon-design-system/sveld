<script>
  /**
   * @typedef {object} RealTypedef
   * @property {string} name
   */

  /** @type {RealTypedef} */
  export let real = { name: "hello" };
</script>

<span>{real.name}</span>

<style>
  /**
   * A comment shaped like a JSDoc block, sitting inside a top-level <style>
   * block. It must not be picked up as a custom-type declaration.
   *
   * @typedef {object} FakeTypedef
   * @property {string} name
   */
  span {
    color: red;
  }
</style>
