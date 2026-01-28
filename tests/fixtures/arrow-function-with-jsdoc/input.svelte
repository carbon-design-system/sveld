<script>
  /** @type {(value: string, options?: { uppercase?: boolean }) => string} */
  export let transform = (value, options) => {
    if (options?.uppercase) return value.toUpperCase();
    return value;
  };

  /** @type {(items: string[], callback: (item: string, index: number) => void) => Promise<void>} */
  export let processItems = async (items, callback) => {
    for (let i = 0; i < items.length; i++) callback(items[i], i);
  };

  /** @type {(id: string) => { id: string; created: Date }} */
  export let createRecord = (id) => ({ id, created: new Date() });
</script>

<div on:click={() => transform("test")}>Click</div>
