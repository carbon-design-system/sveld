<script>
  import { createEventDispatcher } from "svelte";
  import FileUploaderButton from "./FileUploaderButton.svelte";

  /**
   * @event {ReadonlyArray<File>} add
   * @event {ReadonlyArray<File>} remove
   * @event {ReadonlyArray<File>} change
   */

  const dispatch = createEventDispatcher();

  export let files = [];

  function handleAdd() {
    dispatch("add", files);
  }

  function handleRemove() {
    dispatch("remove", files);
  }
</script>

<!-- Forwarding 'change' event from component, but with explicit @event detail type -->
<FileUploaderButton
  on:change
  on:change={(e) => {
    files = e.detail;
  }}
/>

<button on:click={handleAdd}>Add</button>
<button on:click={handleRemove}>Remove</button>
