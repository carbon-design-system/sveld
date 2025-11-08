import type { SvelteComponentTyped } from "svelte";

export type BreadcrumbItemContext = Record<string, never>;

export type ContextEmptyProps = Record<string, never>;

export default class ContextEmpty extends SvelteComponentTyped<
  ContextEmptyProps,
  Record<string, any>,
  Record<string, never>
> {}
