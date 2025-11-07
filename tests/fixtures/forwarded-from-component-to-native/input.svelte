<script>
  import { createEventDispatcher } from 'svelte';
  import ChildComponent from './ChildComponent.svelte';

  const dispatch = createEventDispatcher();

  /**
   * @event expand
   * @event collapse
   */
</script>

<!-- These events are forwarded from a component that itself forwards from native elements -->
<ChildComponent
  on:click
  on:mouseover
  on:mouseenter
  on:mouseleave
/>

<!-- These are dispatched custom events -->
<button on:click={() => dispatch('expand')}>Expand</button>
<button on:click={() => dispatch('collapse')}>Collapse</button>
