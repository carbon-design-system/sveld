<svelte:options customElement="my-widget" />

<script>
  let { value } = $props();

  let count = $state(0);
  let label = "none";

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

  function change() {
    $host().dispatchEvent(new CustomEvent("change", { detail: { count, label } }));
  }

  function clear() {
    $host().dispatchEvent(new CustomEvent("clear", { detail: null }));
  }

  function tick() {
    $host().dispatchEvent(new CustomEvent("tick", { detail: count }));
  }
</script>

<button onclick={notify}>{value}</button>
<button onclick={ready}>ready</button>
<button onclick={close}>close</button>
<button onclick={change}>change</button>
<button onclick={clear}>clear</button>
<button onclick={tick}>tick</button>
