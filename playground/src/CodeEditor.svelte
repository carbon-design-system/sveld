<script context="module">
  import CodeMirror from "codemirror";
  import "codemirror/mode/htmlmixed/htmlmixed";
  import "codemirror/theme/zenburn.css";
</script>

<script>
  // @ts-check
  export let code = "";
  export let codemirror = null;

  import { onMount, createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  let ref;

  onMount(() => {
    codemirror = CodeMirror(ref, {
      value: code,
      mode: "htmlmixed",
      theme: "zenburn",
    });
    codemirror.doc.on("change", () => {
      dispatch("change", codemirror.getValue());
    });

    return () => {
      codemirror = null;
    };
  });
</script>

<div bind:this={ref} />

<style>
  /**
    * Styles adapted from @joshnuss/svelte-codemirror
    * @see https://github.com/joshnuss/svelte-codemirror/blob/e456dbf4377efe2d4f84162dd001b20428f71583/src/Component.svelte
    */

  :global(.CodeMirror) {
    font-family: var(--cds-code-02-font-family);
    font-size: var(--cds-code-02-font-size);
    font-weight: var(--cds-code-02-font-weight);
    letter-spacing: var(--cds-code-02-letter-spacing);
    line-height: var(--cds-code-02-line-height);
    height: calc(100vh - 13rem);
    padding: 1rem 0.75rem;
  }

  @media (max-width: 1056px) {
    :global(.CodeMirror) {
      height: auto;
    }
  }

  :global(.cm-s-zenburn.CodeMirror) {
    background-color: var(--cds-ui-01);
  }

  /** Hide the cursor if the editor is blurred */
  :global(.CodeMirror:not(.CodeMirror-focused) .CodeMirror-cursor) {
    display: none;
  }

  :global(.CodeMirror) {
    position: relative;
    overflow: hidden;
  }

  :global(.CodeMirror-scroll) {
    position: relative;
    overflow: scroll;
    margin-bottom: -30px;
    margin-right: -30px;
    padding-bottom: 30px;
    height: 100%;
  }

  :global(.CodeMirror-sizer) {
    position: relative;
    border-right: 30px solid transparent;
  }

  :global(.CodeMirror-vscrollbar),
  :global(.CodeMirror-hscrollbar),
  :global(.CodeMirror-scrollbar-filler),
  :global(.CodeMirror-gutter-filler) {
    position: absolute;
    z-index: 6;
    display: none;
  }

  :global(.CodeMirror-lines) {
    cursor: text;
  }

  :global(.CodeMirror ::-webkit-scrollbar) {
    width: 10px;
    height: 10px;
  }

  :global(.CodeMirror ::-webkit-scrollbar-track) {
    background: var(--cds-ui-02);
    border-radius: 10px;
  }

  :global(.CodeMirror ::-webkit-scrollbar-thumb) {
    border-radius: 10px;
    background: var(--cds-ui-04);
  }

  :global(.CodeMirror-vscrollbar) {
    right: 0;
    top: 0;
    overflow-x: hidden;
    overflow-y: scroll;
  }

  :global(.CodeMirror-hscrollbar) {
    bottom: 0;
    left: 0;
    overflow-y: hidden;
    overflow-x: scroll;
    height: 10px;
  }

  :global(.CodeMirror-scrollbar-filler) {
    right: 0;
    bottom: 0;
  }

  :global(.CodeMirror-gutter-filler) {
    left: 0;
    bottom: 0;
  }

  :global(.CodeMirror-gutters) {
    position: absolute;
    z-index: 3;
    left: 0;
    top: 0;
    min-height: 100%;
  }

  :global(.CodeMirror-gutter) {
    white-space: normal;
    height: 100%;
    display: inline-block;
    vertical-align: top;
    margin-bottom: -30px;
  }

  :global(.CodeMirror-gutter-wrapper) {
    position: absolute;
    z-index: 4;
    background: none !important;
    border: none !important;
  }

  :global(.CodeMirror-gutter-background) {
    position: absolute;
    z-index: 4;
    top: 0;
    bottom: 0;
  }

  :global(.CodeMirror pre.CodeMirror-line),
  :global(.CodeMirror pre.CodeMirror-line-like) {
    position: relative;
    z-index: 2;
    margin: 0;
    white-space: pre;
    word-wrap: normal;
    line-height: 1.5;
    overflow: visible;
  }

  :global(.CodeMirror-wrap pre.CodeMirror-line),
  :global(.CodeMirror-wrap pre.CodeMirror-line-like) {
    word-wrap: break-word;
    word-break: normal;
    white-space: pre-wrap;
  }

  :global(.CodeMirror-linebackground) {
    position: absolute;
    z-index: 0;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
  }

  :global(.CodeMirror-scroll),
  :global(.CodeMirror-sizer),
  :global(.CodeMirror-gutter),
  :global(.CodeMirror-gutters),
  :global(.CodeMirror-linenumber) {
    box-sizing: content-box;
  }

  :global(.CodeMirror-measure) {
    position: absolute;
    width: 100%;
    height: 0;
    overflow: hidden;
    visibility: hidden;
  }

  :global(.CodeMirror-cursor) {
    position: absolute;
    pointer-events: none;
  }
</style>
