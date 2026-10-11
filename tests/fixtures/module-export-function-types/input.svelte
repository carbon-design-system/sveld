<script context="module">
  /** @type {(cb: () => void) => string} */
  export const withCallback = (cb) => "";

  /** @type {<T>(value: T) => () => T} */
  export const curried = (value) => () => value;

  /** @type {{ onClose: () => void }} */
  export const handlers = { onClose: () => {} };

  /** @type {(() => void) | null} */
  export const maybeHandler = null;

  /** @type {(value: string) => void} */
  export let reassignable = () => {};
</script>
