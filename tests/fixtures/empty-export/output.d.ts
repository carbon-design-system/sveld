import type { SvelteComponentTyped } from "svelte";

export type EmptyExportProps = Record<string, never>;

export default class EmptyExport extends SvelteComponentTyped<
  EmptyExportProps,
  Record<string, any>,
  Record<string, never>
> {}
