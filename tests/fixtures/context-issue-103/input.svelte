<script>
  import { setContext } from "svelte";

  /**
   * Log a message to the console
   * @type {(message: string) => void}
   */
  const log = (message) => {
    console.log(message);
  };

  setContext("my-logger", log);
</script>

<div>
  <slot />
</div>
