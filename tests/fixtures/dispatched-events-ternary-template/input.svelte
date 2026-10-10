<script>
  /**
   * @event {MouseEvent} mouseenter:trigger
   * @event {null} stale
   */
  import { createEventDispatcher } from "svelte";

  export let open = false;

  const dispatch = createEventDispatcher();

  function toggle() {
    open = !open;
    dispatch(open ? "open" : "close", { trigger: "toggle" });
  }

  const forward = (name) => (event) => dispatch(`${name}:trigger`, event);
</script>

<button
  on:click={toggle}
  on:mouseenter={forward("mouseenter")}
>
  Toggle
</button>
