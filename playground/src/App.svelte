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
  import { ComponentParser } from "../../src/browser";
  import CodeEditor from "./CodeEditor.svelte";
  import data from "./data";
  import Header from "./Header.svelte";
  import TabContentOverlay from "./TabContentOverlay.svelte";

  const parser = new ComponentParser();

  type TabProps = {
    parsed_component?: Record<string, unknown>;
    moduleName?: string;
  };

  let selectedId = data[0].moduleName;
  let selectedTab = 0;
  let tabComponents: Array<Component<TabProps> | undefined> = [];
  let tabLoading: boolean[] = [];

  async function loadTabModule(index: number) {
    switch (index) {
      case 0:
        return import("./TabTypeScript.svelte");
      case 1:
        return import("./TabJson.svelte");
      case 2:
        return import("./TabMarkdown.svelte");
      case 3:
        return import("./TabCustomElements.svelte");
      default:
        throw new Error(`Unknown tab index: ${index}`);
    }
  }

  async function ensureTabLoaded(index: number) {
    if (tabComponents[index] || tabLoading[index]) return;

    tabLoading[index] = true;

    const importee = await loadTabModule(index);
    tabComponents[index] = importee.default;
    tabComponents = [...tabComponents];
  }

  function handleTabChange(event: CustomEvent<number>) {
    ensureTabLoaded(event.detail);
  }

  onMount(() => {
    ensureTabLoaded(0);
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
        <CodeEditor bind:code={value} />
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
          bind:selected={selectedTab}
          on:change={handleTabChange}
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
              {#if selectedTab === 0}
                {#if tabComponents[0]}
                  <svelte:component
                    this={tabComponents[0]}
                    {parsed_component}
                    {moduleName}
                  />
                {:else}
                  <InlineLoading style="margin: var(--cds-spacing-05)" />
                {/if}
              {/if}
            </TabContent>
            <TabContent>
              {#if selectedTab === 1}
                {#if tabComponents[1]}
                  <svelte:component
                    this={tabComponents[1]}
                    {parsed_component}
                    {moduleName}
                  />
                {:else}
                  <InlineLoading style="margin: var(--cds-spacing-05)" />
                {/if}
              {/if}
            </TabContent>
            <TabContent>
              {#if selectedTab === 2}
                {#if tabComponents[2]}
                  <svelte:component
                    this={tabComponents[2]}
                    {parsed_component}
                    {moduleName}
                  />
                {:else}
                  <InlineLoading style="margin: var(--cds-spacing-05)" />
                {/if}
              {/if}
            </TabContent>
            <TabContent>
              {#if selectedTab === 3}
                {#if tabComponents[3]}
                  <svelte:component
                    this={tabComponents[3]}
                    {parsed_component}
                    {moduleName}
                  />
                {:else}
                  <InlineLoading style="margin: var(--cds-spacing-05)" />
                {/if}
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
