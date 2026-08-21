<script lang="ts">
  export let size: "sm" | "lg" = "sm";
  export let label: string | undefined = undefined;
  export let items: string[] = [];
</script>

<!--
  TypeScript twin of template-expression-shapes: `lang="ts"` switches the
  fallback to the TS-extended acorn parser, so trivial shapes must still
  fast-path and TS-only syntax must still reach acorn.
-->

<div
  data-ident={label}
  data-member={items.length}
  data-eq={size === "sm"}
  data-nullish={label ?? "none"}
  data-not={!label}
  data-int={42}
>
  {items[0]}
</div>

<span
  data-as={label as string}
  data-nonnull={label!}
  data-satisfies={size satisfies string}
  data-as-const={size as const}
>
  {(label as string).length}
</span>

{#each items as item, i (item)}
  <i>{item as string}</i>
{/each}
