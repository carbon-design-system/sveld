<script context="module">
  // should not be exported
  const c = 0;
  const d = () => {};

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
</script>

<script>
  export const a = "";
</script>
