import type { SvelteComponentTyped } from "svelte";

export interface SlotsSpreadProps {}

export default class SlotsSpread extends SvelteComponentTyped<
  SlotsSpreadProps,
  Record<string, any>,
  { default: {}; text: {} }
> {}
