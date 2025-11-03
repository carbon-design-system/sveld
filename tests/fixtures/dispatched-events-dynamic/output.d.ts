import type { SvelteComponentTyped } from "svelte";

export type DispatchedEventsDynamicProps = Record<string, never>;

export default class DispatchedEventsDynamic extends SvelteComponentTyped<
  DispatchedEventsDynamicProps,
  { KEY: CustomEvent<{ key: string }> },
  Record<string, never>
> {}
