<script>
  /**
   * A `@slot` type wins over the type a dotted access would resolve to.
   * @slot {{ item: "override" }} typed
   */

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

  /** @type {{ onClick: (e: MouseEvent) => void; label: string }} */
  export let item = { onClick: () => {}, label: "" };

  /** @type {{ readonly id: string; format(): string }} */
  let frozen = { id: "", format: () => "" };

  let key = "value";
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
  j={item.label}
  k={frozen.id}
  computed={explicit[key]}
  chained={nested.inner.deep}
/>
<slot
  name="typed"
  item={explicit.value}
/>
