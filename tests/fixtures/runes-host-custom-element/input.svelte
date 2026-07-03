<svelte:options customElement="my-widget" />

<script>
  let { value } = $props();

  const host = $host();

  function notify() {
    host.dispatchEvent(new CustomEvent("notify", { detail: value }));
  }

  function ready() {
    $host().dispatchEvent(new CustomEvent("ready", { detail: "loaded" }));
  }

  function close() {
    $host().dispatchEvent(new Event("close"));
  }
</script>

<button onclick={notify}>{value}</button>
<button onclick={ready}>ready</button>
<button onclick={close}>close</button>
