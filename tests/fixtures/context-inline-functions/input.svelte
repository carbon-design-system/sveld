<script>
  import { setContext } from "svelte";

  // Direct object literal with inline functions (no explicit types)
  setContext("modal", {
    open: (component, props) => {
      console.log("Opening", component, props);
    },
    close: () => {
      console.log("Closing");
    },
    select: (/** @type {string} */ id, /** @type {boolean} */ focus) => {
      console.log(id, focus);
    },
  });
</script>

<div class="modal"><slot /></div>
