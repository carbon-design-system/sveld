<script>
  // @ts-check
  export let parsed_component = {};
  export let moduleName = "";

  import plugin from "prettier/parser-typescript";
  import prettier from "prettier/standalone";
  import { writeTsDefinition } from "../../src/writer/writer-ts-definitions";
  import CodeHighlighter from "./CodeHighlighter.svelte";
  import TabContentOverlay from "./TabContentOverlay.svelte";

  let prettier_error = null;

  $: code = writeTsDefinition({
    ...parsed_component,
    moduleName,
  });
  $: {
    try {
      prettier_error = null;
      code = prettier.format(code, {
        parser: "typescript",
        plugins: [plugin],
      });
    } catch (error) {
      prettier_error = error;
    }
  }
</script>

{#if prettier_error}
  <TabContentOverlay title="TypeScript formatting error" kind="warning">
    {prettier_error}
  </TabContentOverlay>
{/if}
<CodeHighlighter language="typescript" {code} />
