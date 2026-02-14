<script>
  /** @type {{ value: string }} */
  let explicit = { value: "hello" };

  /** @type {{ name: string; count: number; active: boolean }} */
  let multi = { name: "", count: 0, active: false };

  /** @type {{ label?: string }} */
  let optional = { label: undefined };

  /** @type {{ status: "pending" | "done" | "error" }} */
  let union = { status: "pending" };

  /** @type {{ inner: { deep: number } }} */
  let nested = { inner: { deep: 42 } };

  /** @type {{ items: Array<string> }} */
  let generic = { items: [] };

  let inferred = { noType: "hello" };

  /** @type {{ x: number; y: number }} */
  export let point = { x: 0, y: 0 };
</script>

<slot
  a={explicit.value}
  b={multi.name}
  c={multi.count}
  d={optional.label}
  e={union.status}
  f={nested.inner}
  g={generic.items}
  h={inferred.noType}
  i={point.x}
/>
