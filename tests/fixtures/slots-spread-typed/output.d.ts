import type { SvelteComponentTyped } from "svelte";

export type SlotsSpreadTypedProps = Record<string, never>;

export default class SlotsSpreadTyped extends SvelteComponentTyped<
  SlotsSpreadTypedProps,
  Record<string, any>,
  { default: { a: number }; text: { a: number } }
> {}
