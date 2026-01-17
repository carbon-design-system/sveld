import { SvelteComponentTyped } from "svelte";

export type SlotsSpreadTypedProps = {
  text?: () => void;
};

export default class SlotsSpreadTyped extends SvelteComponentTyped<
  SlotsSpreadTypedProps,
  Record<string, any>,
  { default: { a: number }; text: { a: number } }
> {}
