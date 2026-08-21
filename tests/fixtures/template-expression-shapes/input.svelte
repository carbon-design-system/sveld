<script>
  export let size = "sm";
  export let disabled = false;
  export let items = [];
  export let refs = [];
  export let label = undefined;
</script>

<!--
  Boundary shapes for the template-expression fast path
  (src/template-parse/expression.ts). The first two groups parse without
  acorn; the third must fall back. The shim test compares this whole file
  against svelte/compiler, and the parser fuzzer mutates it as a seed.
-->

<div
  data-ident={label}
  data-member={items.length}
  data-deep={a.b.c.d}
  data-keyword-prop={items.class}
  data-index={items[0]}
  data-index-chain={refs[10].id}
  data-string-key={$$props["aria-label"]}
  data-single-quote-key={$$props['aria-hidden']}
  data-true={true}
  data-false={false}
  data-null={null}
  data-undefined={undefined}
  data-int={42}
  data-zero={0}
  data-string={"str"}
  data-string-single={'str'}
  data-empty-string={""}
  data-spaced={ label }
>
  {label}
  {items[0]}
  {!disabled}
  {!!disabled}
  {! disabled}
  {items.length === 0}
</div>

<span
  class:sm={size === "sm"}
  class:not-lg={size !== "lg"}
  class:loose-eq={size == "md"}
  class:tight={size!== "xl"}
  class:both={!disabled && !label}
  data-and={disabled && label}
  data-or={label || "fallback"}
  data-nullish={label ?? "none"}
  data-mirrored={"sm" === size}
>{size === "lg"}</span>

<button
  {...$$restProps}
  bind:this={refs[0]}
  on:click={() => label}
  on:keydown={(e) => e.key}
  data-ternary={disabled ? "y" : "n"}
  data-two-ops={size === "sm" || size === "md"}
  data-call={items.includes(size)}
  data-optional={label?.length}
  data-optional-index={items?.[0]}
  data-template={`size-${size}`}
  data-escape={"a\nb"}
  data-float={5.5}
  data-hex={0x1f}
  data-exponent={5e3}
  data-negative={-1}
  data-paren={(label)}
  data-comment={label /* trailing */}
  data-arith={items.length + 1}
>
  {disabled ? "on" : "off"}
</button>

{#if !disabled}
  <em>enabled</em>
{:else if size === "sm"}
  <em>small</em>
{/if}

{#each items as item, i (item.id)}
  <i>{item}</i>
{:else}
  <i>empty</i>
{/each}
