<script lang="ts">
  export let code = "";
  export let language: import("svelte-highlight").LanguageType;
  export let noWrap = false;

  import { CopyButton } from "carbon-components-svelte";
  import { onMount } from "svelte";
  import Highlight from "svelte-highlight";
  import githubStyles from "svelte-highlight/styles/github.css?url";
  import zenburnStyles from "svelte-highlight/styles/zenburn.css?url";
  import { type Theme, theme } from "./theme";

  const HIGHLIGHT_STYLES: Record<Theme, string> = {
    g100: zenburnStyles,
    white: githubStyles,
  };

  let highlightStylesheet: HTMLLinkElement | undefined;

  function setHighlightTheme(value: Theme) {
    if (!highlightStylesheet) {
      highlightStylesheet = document.createElement("link");
      highlightStylesheet.rel = "stylesheet";
      document.head.appendChild(highlightStylesheet);
    }

    highlightStylesheet.href = HIGHLIGHT_STYLES[value];
  }

  onMount(() => {
    setHighlightTheme($theme);

    return theme.subscribe(setHighlightTheme);
  });
</script>

<div
  class="code-highlighter"
  class:noWrap
>
  <div><CopyButton text={code} /></div>
  <Highlight
    {language}
    {code}
  />
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
    background: var(--cds-ui-01);
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
