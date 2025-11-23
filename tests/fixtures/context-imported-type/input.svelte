<script>
  import { setContext } from "svelte";

  /**
   * @typedef {object} ModalAPI
   * @property {() => void} open
   * @property {() => void} close
   */

  /**
   * Modal API object
   * @type {ModalAPI}
   */
  const modalAPI = {
    open: () => {
      console.log("Opening modal");
    },
    close: () => {
      console.log("Closing modal");
    },
  };

  setContext("modal", modalAPI);
</script>

<div class="modal-wrapper">
  <slot />
</div>
