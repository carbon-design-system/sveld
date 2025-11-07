<script>
  import { setContext } from 'svelte';

  /**
   * @typedef {object} TabData
   * @property {string} id
   * @property {string} label
   * @property {boolean} [disabled]
   */

  /**
   * Register a new tab
   * @type {(tab: TabData) => void}
   */
  const addTab = (tab) => {
    console.log('Adding tab', tab);
  };

  /**
   * Remove a tab by ID
   * @type {(id: string) => void}
   */
  const removeTab = (id) => {
    console.log('Removing tab', id);
  };

  setContext('tabs', { addTab, removeTab });
</script>

<div class="tabs">
  <slot />
</div>
