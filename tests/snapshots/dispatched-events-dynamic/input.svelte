<script>
  /**
   * @event {{key: string;}} KEY
   */
  import { createEventDispatcher } from "svelte";

  const dispatcher = createEventDispatcher();

  const KEY = "KEY";
</script>

<button
  on:keydown={(e) => {
    dispatcher(e.key);
    dispatcher(KEY, { key: e.key });
  }} />
