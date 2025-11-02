<script lang="ts" context="module">
  import json from "svelte-highlight/languages/json";
  import markdown from "svelte-highlight/languages/markdown";
  import typescript from "svelte-highlight/languages/typescript";

  const LANG = {
    json,
    typescript,
    markdown,
  } as const;
</script>

<script lang="ts">
  export let code = "";
  export let language: keyof typeof LANG = "typescript";
  export let noWrap = false;

  import { CopyButton } from "carbon-components-svelte";
  import Highlight from "svelte-highlight";
  import "svelte-highlight/styles/zenburn.css";
</script>

<div class="code-highlighter" class:noWrap>
  <div>
    <CopyButton text={code} />
  </div>
  <Highlight language={LANG[language]} {code} />
</div>

<style>
  .code-highlighter {
    position: relative;
    display: flex;
    flex: 1;
    width: 100%;
  }

  .code-highlighter div {
    position: absolute;
    top: 0.5rem;
    right: 1.5rem;
  }

  :global(code.hljs) {
    background: var(--cds-ui-01); /** TODO: use token */
    font-family: var(--cds-code-02-font-family);
    font-size: var(--cds-code-02-font-size);
    font-weight: var(--cds-code-02-font-weight);
    letter-spacing: var(--cds-code-02-letter-spacing);
    line-height: var(--cds-code-02-line-height);
    cursor: text;
  }

  :global(.code-highlighter:not(.noWrap) code.hljs) {
    white-space: pre-wrap;
  }

  :global(pre code.hljs) {
    padding: 1rem;
  }
</style>
