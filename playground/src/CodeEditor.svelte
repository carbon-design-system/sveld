<script lang="ts">
  import { HighlightEditable, HighlightStyle } from "svelte-highlight";
  import svelte from "svelte-highlight/languages/svelte";
  import github from "svelte-highlight/styles/github";
  import zenburn from "svelte-highlight/styles/zenburn";

  export let code = "";
</script>

<HighlightStyle
  light={github}
  dark={zenburn}
  mode={'[theme="g100"]'}
>
  <HighlightEditable
    language={svelte}
    --outline-width="0px"
    bind:code
    class="code-editor"
  />
</HighlightStyle>

<style>
  :global(.code-editor) {
    flex: 1;
    margin: 0;
    height: calc(100vh - 13rem);
    overflow-y: auto;
  }

  @media (max-width: 1056px) {
    :global(.code-editor) {
      height: auto;
    }
  }

  :global(.code-editor code.hljs) {
    background: var(--cds-ui-01);
    font-family: var(--cds-code-02-font-family);
    font-size: var(--cds-code-02-font-size);
    font-weight: var(--cds-code-02-font-weight);
    letter-spacing: var(--cds-code-02-letter-spacing);
    line-height: var(--cds-code-02-line-height);
    min-height: 100%;
    padding: 1rem 0.75rem;
    white-space: pre-wrap;
  }

  :global([theme="g100"] .code-editor code.hljs) {
    background: var(--cds-ui-01);
  }
</style>
