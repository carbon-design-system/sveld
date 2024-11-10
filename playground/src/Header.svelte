<script>
  // @ts-check
  import { Header, Content, HeaderUtilities, HeaderActionLink, SkipToContent } from "carbon-components-svelte";
  import LogoGithub20 from "./LogoGithub20.svelte";
  import pkg from "../../package.json";
</script>

<svelte:head>
  <title>{pkg.name}</title>
</svelte:head>

<Header aria-label="Navigation" href="/">
  <SkipToContent slot="skip-to-content" />
  <span slot="platform">
    {pkg.name}
    <code title="Version {pkg.version}">v{pkg.version}</code>
  </span>
  <HeaderUtilities>
    <HeaderActionLink icon={LogoGithub20} href={pkg.homepage} target="_blank" />
  </HeaderUtilities>
</Header>

<Content>
  <slot />
</Content>

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
    color: #c6c6c6;
  }
</style>
