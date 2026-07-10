<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    label,
    onclick,
    onpress,
    value = $bindable("ready"),
    children,
  }: {
    label: string;
    onclick?: (event: MouseEvent) => void;
    onpress?: (value: string) => void;
    value?: string;
    children?: Snippet<[{ value: string }]>;
  } = $props();
</script>

<button
  onclick={(event) => {
    onclick?.(event);
    onpress?.(value);
  }}
>
  {label}
  {@render children?.({ value })}
</button>
