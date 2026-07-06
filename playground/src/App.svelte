<script lang="ts">
  import {
    Column,
    Dropdown,
    FormLabel,
    Grid,
    InlineLoading,
    Row,
    Tab,
    TabContent,
    Tabs,
  } from "carbon-components-svelte";
  import Code from "carbon-icons-svelte/lib/Code.svelte";
  import Cube from "carbon-icons-svelte/lib/Cube.svelte";
  import Json from "carbon-icons-svelte/lib/Json.svelte";
  import TextCreation from "carbon-icons-svelte/lib/TextCreation.svelte";
  import { type Component, onMount } from "svelte";
  import ComponentParser from "../../src/ComponentParser";
  import data from "./data";
  import Header from "./Header.svelte";
  import TabContentOverlay from "./TabContentOverlay.svelte";

  const parser = new ComponentParser();

  type TabProps = {
    parsed_component?: Record<string, unknown>;
    moduleName?: string;
  };

  let selectedId = data[0].moduleName;
  let codeEditor: Component | undefined;
  let tabTypeScript: Component<TabProps> | undefined;
  let tabJson: Component<TabProps> | undefined;
  let tabMarkdown: Component<TabProps> | undefined;
  let tabCustomElements: Component<TabProps> | undefined;

  onMount(() => {
    import("./CodeEditor.svelte").then((importee) => {
      codeEditor = importee.default;
    });

    import("./TabTypeScript.svelte").then((importee) => {
      tabTypeScript = importee.default;
    });

    import("./TabJson.svelte").then((importee) => {
      tabJson = importee.default;
    });

    import("./TabMarkdown.svelte").then((importee) => {
      tabMarkdown = importee.default;
    });

    import("./TabCustomElements.svelte").then((importee) => {
      tabCustomElements = importee.default;
    });
  });

  $: selected = data.find((datum) => datum.moduleName === selectedId);
  $: value = selected?.code;
  $: moduleName = selected?.moduleName ?? "Component";

  let parsed_component = {};
  let parse_error: string | null = null;

  $: {
    try {
      parse_error = null;

      if (value) {
        parsed_component = parser.parseSvelteComponent(value, {
          moduleName,
          filePath: "VIRTUAL",
        });
      }
    } catch (error) {
      parse_error = error as string;
    }
  }
</script>

<Header>
  <Grid
    noGutter
    padding
  >
    <Row>
      <Column
        xlg={7}
        lg={6}
        sm={8}
      >
        <Dropdown
          size="xl"
          labelText="Svelte code"
          {selectedId}
          items={data.map((datum) => ({
            id: datum.moduleName,
            text: datum.name,
          }))}
          on:select={(e) => {
            selectedId = e.detail.selectedId;
          }}
        />
        {#if codeEditor}
          <svelte:component
            this={codeEditor}
            bind:code={value}
          />
        {:else}
          <InlineLoading style="margin: var(--cds-spacing-05)" />
        {/if}
      </Column>
      <Column
        xlg={9}
        lg={10}
        sm={8}
      >
        <FormLabel id="output">Sveld output</FormLabel>
        <Tabs
          type="container"
          id="output"
        >
          <Tab
            label="TypeScript"
            icon={Code}
          />
          <Tab
            label="JSON"
            icon={Json}
          />
          <Tab
            label="Markdown"
            icon={TextCreation}
          />
          <Tab
            label="Custom Elements"
            icon={Cube}
          />
          <div
            class="tab-content-slot"
            slot="content"
          >
            {#if parse_error}
              <TabContentOverlay title="Parse error"> {parse_error} </TabContentOverlay>
            {/if}
            <TabContent>
              {#if tabTypeScript}
                <svelte:component
                  this={tabTypeScript}
                  {parsed_component}
                  {moduleName}
                />
              {:else}
                <InlineLoading style="margin: var(--cds-spacing-05)" />
              {/if}
            </TabContent>
            <TabContent>
              {#if tabJson}
                <svelte:component
                  this={tabJson}
                  {parsed_component}
                  {moduleName}
                />
              {:else}
                <InlineLoading style="margin: var(--cds-spacing-05)" />
              {/if}
            </TabContent>
            <TabContent>
              {#if tabMarkdown}
                <svelte:component
                  this={tabMarkdown}
                  {parsed_component}
                  {moduleName}
                />
              {:else}
                <InlineLoading style="margin: var(--cds-spacing-05)" />
              {/if}
            </TabContent>
            <TabContent>
              {#if tabCustomElements}
                <svelte:component
                  this={tabCustomElements}
                  {parsed_component}
                  {moduleName}
                />
              {:else}
                <InlineLoading style="margin: var(--cds-spacing-05)" />
              {/if}
            </TabContent>
          </div>
        </Tabs>
      </Column>
    </Row>
  </Grid>
</Header>

<style>
  :global(.bx--inline-loading) {
    justify-content: center;
  }

  :global(.tab-content-slot) {
    position: relative;
    height: calc(100vh - 13rem);
  }

  @media (max-width: 1056px) {
    :global(.tab-content-slot) {
      height: auto;
    }
  }

  :global(.bx--tab-content) {
    padding: 0;
    position: relative;
  }

  :global(.bx--tab-content[aria-hidden="false"]) {
    display: flex;
    height: 100%;
    overflow-y: auto;
  }

  :global(pre) {
    display: flex;
    flex: 1;
    overflow-y: auto;
  }

  :global(textarea.bx--text-area) {
    height: calc(100vh - 3rem - 11rem);
  }

  :global(pre code) {
    flex: 1;
  }
</style>
