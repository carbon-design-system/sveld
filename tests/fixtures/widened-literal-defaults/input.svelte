<script>
  export let sizes = { sm: false, md: true };
  export let rows = [{ id: 1, label: "a" }];
  export let matrix = [[1, 2], [3]];
  export let mixed = [1, "two", null];
  export let members = { none: null, missing: undefined, pattern: /a+/, big: 10n, offset: -1, text: `t` };
  export let quoted = { "data-id": "x", 0: 1 };
  export let nested = { list: [], map: {} };

  export const ids = { close: "close", open: "open" };
  export const steps = [1, -2, `three`, null];

  const fallback = 1;
  export let shorthand = { fallback };
</script>

<div>{sizes.sm}</div>
