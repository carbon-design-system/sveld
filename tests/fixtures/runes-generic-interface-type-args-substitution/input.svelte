<script lang="ts">
  interface Props<T, U extends unknown[], F> {
    values: T[];
    tuple: [...U, T];
    label: `T-${T & string}`;
    callback: F | null;
  }
  let { values, tuple, label, callback }: Props<"a" | "b", [number], () => void> = $props();
</script>

<button
  title={label}
  on:click={() => callback?.()}
>
  {values.length} {tuple.length}
</button>
