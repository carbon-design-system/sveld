<script>
  import { setContext } from 'svelte';

  /**
   * Close the modal
   * @type {() => void}
   */
  const close = () => {};

  /**
   * Open the modal with content
   * @type {(component: any, props?: any) => void}
   */
  const open = (component, props) => {};

  setContext('simple-modal', { open, close });
</script>

<div class="modal">
  <slot />
</div>
