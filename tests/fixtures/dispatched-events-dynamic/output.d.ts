import type { SvelteComponentTyped } from "svelte";

export interface DispatchedEventsDynamicProps {}

export default class DispatchedEventsDynamic extends SvelteComponentTyped<
  DispatchedEventsDynamicProps,
  { KEY: CustomEvent<{ key: string }> },
  {}
> {}
