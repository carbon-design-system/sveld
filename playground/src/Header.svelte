<script lang="ts">
  import {
    Content,
    Header,
    HeaderActionLink,
    HeaderGlobalAction,
    HeaderUtilities,
    SkipToContent,
  } from "carbon-components-svelte";
  import { homepage, name, version } from "../../package.json";
  import LogoGithub20 from "./LogoGithub20.svelte";
  import { toggleTheme } from "./theme";
  import ThemeIcon from "./ThemeIcon.svelte";
</script>

<svelte:head><title>{name}</title></svelte:head>

<Header aria-label="Navigation" href="/">
  <SkipToContent slot="skipToContent" />
  <span slot="platform">
    {name}
    <code title="Version {version}">v{version}</code>
  </span>
  <HeaderUtilities>
    <HeaderGlobalAction icon={ThemeIcon} iconDescription="Toggle theme" on:click={toggleTheme} />
    <HeaderActionLink icon={LogoGithub20} href={homepage} target="_blank" />
  </HeaderUtilities>
</Header>

<Content><slot /></Content>

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
