<script>
  import { setContext } from "svelte";

  /**
   * @typedef {object} ModalAPI
   * @property {() => void} open
   * @property {() => void} close
   */

  /**
   * Log a message to the console
   * @type {(message: string) => void}
   */
  const log = (message) => {
    console.log(message);
  };

  /**
   * Modal API object
   * @type {ModalAPI}
   */
  const modalAPI = {
    open: () => {},
    close: () => {},
  };

  setContext("my-logger", log);
  setContext("modal", modalAPI);
</script>

<div><slot /></div>
