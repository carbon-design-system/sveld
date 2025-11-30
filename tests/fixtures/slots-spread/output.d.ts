import { SvelteComponentTyped } from "svelte";

export type SlotsSpreadProps = Record<string, never>;

export default class SlotsSpread extends SvelteComponentTyped<
  SlotsSpreadProps,
  Record<string, any>,
  { default: Record<string, never>; text: Record<string, never> }
> {}
