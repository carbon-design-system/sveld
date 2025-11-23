<script>
  import { createEventDispatcher } from "svelte";
  import CustomComponent from "./CustomComponent.svelte";

  /**
   * @event {string} input - Input value changed (native forwarded event)
   * @event {number} customEvent - Custom event from component (component forwarded event)
   */

  const dispatch = createEventDispatcher();

  function handleSubmit() {
    dispatch("submit", { data: "test" });
  }
</script>

<!-- Native element: should use WindowEventMap even with @event detail -->
<input on:input on:change />

<!-- Component: should use CustomEvent with detail type -->
<CustomComponent on:customEvent />

<button on:click={handleSubmit}>Submit</button>
