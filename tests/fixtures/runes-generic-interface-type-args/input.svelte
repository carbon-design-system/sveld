<script lang="ts">
  interface Props<T> {
    value: T;
    onchange?: (T: T) => void;
    kind?: "T" | T;
    map?: { T: T; readonly label: T };
  }
  let { value, onchange, kind, map }: Props<string> = $props();
</script>

<input
  {value}
  data-kind={kind}
  title={map?.label}
  on:change={() => onchange?.(value)}
>
