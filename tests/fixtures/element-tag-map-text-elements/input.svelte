<script>
  /** @restProps {abbr | code | em | strong | mark | kbd | samp | var} */
  /** @type { "abbr" | "code" | "em" | "strong" | "mark" | "kbd" | "samp" | "var" } */
  export let textElement = "code";
</script>

{#if textElement === "abbr"}
  <abbr {...$$restProps} />
{:else if textElement === "code"}
  <code {...$$restProps} />
{:else if textElement === "em"}
  <em {...$$restProps} />
{:else if textElement === "strong"}
  <strong {...$$restProps} />
{:else if textElement === "mark"}
  <mark {...$$restProps} />
{:else if textElement === "kbd"}
  <kbd {...$$restProps} />
{:else if textElement === "samp"}
  <samp {...$$restProps} />
{:else}
  <var {...$$restProps} />
{/if}
