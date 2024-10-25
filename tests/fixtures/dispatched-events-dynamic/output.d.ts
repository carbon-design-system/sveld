import type { SvelteComponentTyped } from "svelte";

export type DispatchedEventsDynamicProps = {};

export default class DispatchedEventsDynamic extends SvelteComponentTyped<
  DispatchedEventsDynamicProps,
  { KEY: CustomEvent<{ key: string }> },
  {}
> {}
