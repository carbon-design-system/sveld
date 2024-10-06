<script lang="ts">
  export let parsed_component = {};
  export let moduleName = "";

  import pluginTypeScript from "prettier/plugins/typescript";
  import pluginEstree from "prettier/plugins/estree";
  import { format } from "prettier/standalone";
  import { writeTsDefinition } from "../../src/writer/writer-ts-definitions";
  import CodeHighlighter from "./CodeHighlighter.svelte";
  import TabContentOverlay from "./TabContentOverlay.svelte";

  let prettier_error = null;

  $: code = writeTsDefinition({
    ...parsed_component,
    moduleName,
  });
  $: {
    prettier_error = null;
    format(code, {
      parser: "typescript",
      plugins: [pluginTypeScript, pluginEstree],
    })
      .then((formatted) => {
        code = formatted;
      })
      .catch((error) => {
        prettier_error = error;
      });
  }
</script>

{#if prettier_error}
  <TabContentOverlay title="TypeScript formatting error" kind="warning">
    {prettier_error}
  </TabContentOverlay>
{/if}
<CodeHighlighter language="typescript" {code} />
