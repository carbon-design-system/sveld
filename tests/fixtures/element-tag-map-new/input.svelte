<script>
  /** @restProps {article | section | nav | main | header | footer} */
  /** @type { "article" | "section" | "nav" | "main" | "header" | "footer" } */
  export let semanticTag = "article";
</script>

{#if semanticTag === "article"}
  <article {...$$restProps} />
{:else if semanticTag === "section"}
  <section {...$$restProps} />
{:else if semanticTag === "nav"}
  <nav {...$$restProps} />
{:else if semanticTag === "main"}
  <main {...$$restProps} />
{:else if semanticTag === "header"}
  <header {...$$restProps} />
{:else if semanticTag === "footer"}
  <footer {...$$restProps} />
{/if}
