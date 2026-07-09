<script lang="ts">
  interface Props<T> {
    value: T;
    onchange?: (v: T) => void;
  }
  let { value, onchange }: Props<string> = $props();
</script>

<input
  {value}
  on:change={() => onchange?.(value)}
>
