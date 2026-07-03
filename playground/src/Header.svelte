<script lang="ts">
  import {
    Content,
    Header,
    HeaderActionLink,
    HeaderGlobalAction,
    HeaderUtilities,
    SkipToContent,
  } from "carbon-components-svelte";
  import Asleep from "carbon-icons-svelte/lib/Asleep.svelte";
  import Light from "carbon-icons-svelte/lib/Light.svelte";
  import pkg from "../../package.json";
  import LogoGithub20 from "./LogoGithub20.svelte";
  // biome-ignore lint/correctness/noUnusedImports: `theme` is used as `$theme` in the markup below
  import { theme, toggleTheme } from "./theme";
</script>

<svelte:head> <title>{pkg.name}</title> </svelte:head>

<Header
  aria-label="Navigation"
  href="/"
>
  <SkipToContent slot="skipToContent" />
  <span slot="platform">
    {pkg.name}
    <code title="Version {pkg.version}">v{pkg.version}</code>
  </span>
  <HeaderUtilities>
    <HeaderGlobalAction
      icon={$theme === "g100" ? Light : Asleep}
      iconDescription="Toggle theme"
      on:click={toggleTheme}
    />
    <HeaderActionLink
      icon={LogoGithub20}
      href={pkg.homepage}
      target="_blank"
    />
  </HeaderUtilities>
</Header>

<Content> <slot /> </Content>

<style>
  :global(.bx--content) {
    padding-top: 1rem;
    background: none;
  }

  span {
    display: flex;
    align-items: baseline;
  }

  span code {
    margin-left: var(--cds-spacing-02);
    font-size: var(--cds-code-01-font-size);
    font-weight: var(--cds-code-01-font-weight);
    letter-spacing: var(--cds-code-01-letter-spacing);
    line-height: var(--cds-code-01-line-height);
  }
</style>
