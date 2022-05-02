<script context="module">
  // should not be exported
  const c = 0;
  const d = () => {};

  export const bool = "";

  export const a = { b: 4 };

  /**
   * Description for e
   * @type {{ [key: string]: any; }}
   */
  export const e = { b: 4 };

  /**
   * Log something
   * @type {(message: string) => void}
   */
  export function log(message) {
    console.log(message);
  }

  export const b = () => {};

  export const b2 = () => () => {};

  /** @type {() => () => false} */
  export const b3 = () => () => false;
</script>

<script>
  export const a = "";
</script>
