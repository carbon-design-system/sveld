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
  import { type Component, onMount } from "svelte";
  import { HighlightStyle } from "svelte-highlight";
  import github from "svelte-highlight/styles/github";
  import zenburn from "svelte-highlight/styles/zenburn";
  import defaultParsed from "./default-parsed";
  import Code16 from "./Code16.svelte";
  import CodeEditor from "./CodeEditor.svelte";
  import data from "./data";
  import Header from "./Header.svelte";
  import Json16 from "./Json16.svelte";
  import TabContentOverlay from "./TabContentOverlay.svelte";
  import TabTypeScript from "./TabTypeScript.svelte";
  import TextCreation16 from "./TextCreation16.svelte";

  // The build inlines the default example's parse, so the parser loads
  // once the code changes, or when the pointer or focus moves into the
  // code column, a few hundred ms before an edit or a new example.
  let sveld: typeof import("./parser") | undefined;
  let parser: import("./parser").ComponentParser | undefined;
  let parserRequested = false;

  function loadParser() {
    if (parserRequested) return;
    parserRequested = true;
    import("./parser").then((module) => {
      parser = new module.ComponentParser();
      sveld = module;
    });
  }

  type TabProps = {
    parsed_component?: Record<string, unknown>;
    moduleName?: string;
  };

  let selectedId = data[0].moduleName;
  let selectedTab = 0;
  let tabComponents: Array<Component<TabProps> | undefined> = [TabTypeScript];
  const tabLoading: boolean[] = [];

  async function loadTabModule(index: number) {
    switch (index) {
      case 1:
        return import("./TabJson.svelte");
      case 2:
        return import("./TabMarkdown.svelte");
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

  // Import the other tabs once the page is idle, so a tab switch renders the
  // tab at once rather than a loading state for a frame or more.
  onMount(() => {
    const load = () => {
      ensureTabLoaded(1);
      ensureTabLoaded(2);
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(load);
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(load);
    return () => clearTimeout(id);
  });

  function handleTabChange(event: CustomEvent<number>) {
    ensureTabLoaded(event.detail);
  }

  $: selected = data.find((datum) => datum.moduleName === selectedId);
  $: value = selected?.code;
  $: moduleName = selected?.moduleName ?? "Component";

  let parsed_component = {};
  let parse_error: string | null = null;
  let parsedCode: string | undefined;

  $: isDefault = defaultParsed !== null && value === data[0].code && moduleName === data[0].moduleName;
  $: if (!isDefault) loadParser();

  $: {
    try {
      parse_error = null;

      if (isDefault && defaultParsed) {
        parsed_component = defaultParsed;
        parsedCode = value;
      } else if (sveld && parser && value) {
        const diagnostics = { moduleName, filePath: "VIRTUAL" };
        parsedCode = value;
        parsed_component = sveld.finalizeWithoutCrossFileResolution(
          parser.parseSvelteComponent(value, diagnostics),
          diagnostics,
        );
      }
    } catch (error) {
      parse_error = error as string;
    }
  }

  $: ready = parsedCode === value;
</script>

<Header>
  <HighlightStyle light={github} dark={zenburn} mode={'[theme="g100"]'}>
    <Grid noGutter padding>
      <Row>
        <Column xlg={7} lg={6} sm={8}>
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="code-column" on:pointerenter={loadParser} on:focusin={loadParser}>
            <Dropdown
              size="xl"
              virtualize={false}
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
          </div>
        </Column>
        <Column xlg={9} lg={10} sm={8}>
          <FormLabel id="output">Sveld output</FormLabel>
          <Tabs type="container" id="output" bind:selected={selectedTab} on:change={handleTabChange}>
            <Tab label="TypeScript" icon={Code16} />
            <Tab label="JSON" icon={Json16} />
            <Tab label="Markdown" icon={TextCreation16} />
            <div class="tab-content-slot" slot="content">
              {#if parse_error}
                <TabContentOverlay title="Parse error">{parse_error}</TabContentOverlay>
              {/if}
              <TabContent>
                {#if selectedTab === 0}
                  {#if ready && tabComponents[0]}
                    <svelte:component this={tabComponents[0]} {parsed_component} {moduleName} />
                  {:else}
                    <InlineLoading style="margin: var(--cds-spacing-05)" />
                  {/if}
                {/if}
              </TabContent>
              <TabContent>
                {#if selectedTab === 1}
                  {#if ready && tabComponents[1]}
                    <svelte:component this={tabComponents[1]} {parsed_component} {moduleName} />
                  {:else}
                    <InlineLoading style="margin: var(--cds-spacing-05)" />
                  {/if}
                {/if}
              </TabContent>
              <TabContent>
                {#if selectedTab === 2}
                  {#if ready && tabComponents[2]}
                    <svelte:component this={tabComponents[2]} {parsed_component} {moduleName} />
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
  </HighlightStyle>
</Header>

<style>
  :global(.bx--inline-loading) {
    justify-content: center;
  }

  .code-column {
    display: contents;
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
